<?php
// Budget Tracker Pro - Main API
// ไฟล์นี้ทำหน้าที่เป็นตัวกลางระหว่าง Frontend (JavaScript) และฐานข้อมูล

header('Content-Type: application/json');
require 'config.php'; // เชื่อมต่อฐานข้อมูล

// รับข้อมูลที่ถูกส่งมาจาก JavaScript
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

// --- ฟังก์ชันช่วยเหลือ (Helper Functions) ---

// ฟังก์ชันสำหรับดึง profile_id (ถ้าไม่มีจะสร้างใหม่)
function get_profile_id($conn, $profile_name) {
    if (empty($profile_name)) {
        throw new Exception("Profile name cannot be empty.");
    }
    // ใช้ Prepared Statement เพื่อความปลอดภัย
    $stmt = $conn->prepare("SELECT profile_id FROM profiles WHERE profile_name = ?");
    $stmt->bind_param("s", $profile_name);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        return $result->fetch_assoc()['profile_id'];
    } else {
        $stmt = $conn->prepare("INSERT INTO profiles (profile_name) VALUES (?)");
        $stmt->bind_param("s", $profile_name);
        if ($stmt->execute()) {
            return $stmt->insert_id;
        }
        return null;
    }
}

// --- ส่วนจัดการคำร้องขอ (API Endpoints) ---

try {
    switch ($action) {
        // ===============================================
        //  GET: ดึงข้อมูลทั้งหมดเมื่อเปิดหน้าเว็บ
        // ===============================================
        case 'get_all_data':
            $profile_name = $_GET['profile'] ?? 'default';
            $year = (int)($_GET['year'] ?? (new DateTime())->format('Y') + 543);
            
            $profile_id = get_profile_id($conn, $profile_name);

            // 1. ดึงโครงสร้างคอลัมน์ (Categories)
            $stmt = $conn->prepare("SELECT category_id, category_name, category_type, due_day, goal_id FROM categories WHERE profile_id = ? AND is_active = 1 ORDER BY category_type, display_order ASC");
            $stmt->bind_param("i", $profile_id);
            $stmt->execute();
            $categories_result = $stmt->get_result();

            $columnStructure = ['income' => [], 'expense' => [], 'savings' => []];
            $expenseDueDates = [];
            $incomeDueDates = [];
            $category_map = []; // Map ID to details for faster lookup
            $has_initial_data = $categories_result->num_rows > 0;

            if ($has_initial_data) {
                while($row = $categories_result->fetch_assoc()) {
                    $category_item = [
                        'id' => (int)$row['category_id'],
                        'name' => $row['category_name']
                    ];
                    if ($row['category_type'] === 'savings') {
                        $category_item['goalId'] = $row['goal_id'] ? (int)$row['goal_id'] : null;
                    }
                    $columnStructure[$row['category_type']][] = $category_item;
                    $category_map[$row['category_id']] = ['name' => $row['category_name'], 'type' => $row['category_type']];
                    if ($row['due_day']) {
                        // ใช้ category_id เป็น key เพื่อความแม่นยำ
                        if ($row['category_type'] === 'income') $incomeDueDates[$row['category_id']] = $row['due_day'];
                        else $expenseDueDates[$row['category_id']] = $row['due_day'];
                    }
                }
            } else {
                // *** START: แก้ไข Logic การสร้างข้อมูลเริ่มต้น ***
                // ถ้าเป็นโปรไฟล์ใหม่ ให้สร้างคอลัมน์เริ่มต้นทั้งหมดเพียงครั้งเดียว
                // 1. สร้าง Income & Expense เริ่มต้น
                $default_cols = [ 'income' => ['เงินเดือน', 'รายได้เสริม'], 'expense' => ['ค่าอาหาร', 'ค่าเดินทาง', 'ค่าใช้จ่ายส่วนตัว'] ];
                foreach ($default_cols as $type => $cols) {
                    foreach ($cols as $index => $col_name) {
                        $stmt_insert = $conn->prepare("INSERT INTO categories (profile_id, category_name, category_type, display_order) VALUES (?, ?, ?, ?)");
                        $stmt_insert->bind_param("issi", $profile_id, $col_name, $type, $index);
                        $stmt_insert->execute();
                        $new_cat_id = $stmt_insert->insert_id;
                        $columnStructure[$type][] = ['id' => $new_cat_id, 'name' => $col_name];
                        $category_map[$new_cat_id] = ['name' => $col_name, 'type' => $type];
                    }
                }
                
                // 2. สร้าง "เงินออมทั่วไป" เริ่มต้นสำหรับโปรไฟล์ใหม่
                $default_goal_name = 'เงินออมทั่วไป';
                // 2.1 สร้างเป้าหมาย (Goal)
                $stmt_goal = $conn->prepare("INSERT INTO savings_goals (profile_id, goal_name, target_amount) VALUES (?, ?, 0)");
                $stmt_goal->bind_param("is", $profile_id, $default_goal_name);
                $stmt_goal->execute();
                $new_goal_id = $stmt_goal->insert_id;

                // 2.2 สร้างหมวดหมู่ (Category) ที่เชื่อมกับ Goal
                $stmt_cat = $conn->prepare("INSERT INTO categories (profile_id, goal_id, category_name, category_type, display_order) VALUES (?, ?, ?, 'savings', 0)");
                $stmt_cat->bind_param("iis", $profile_id, $new_goal_id, $default_goal_name);
                $stmt_cat->execute();
                $new_cat_id = $stmt_cat->insert_id;

                // 2.3 อัปเดตข้อมูลที่จะส่งกลับไป Frontend
                $columnStructure['savings'][] = ['id' => $new_cat_id, 'name' => $default_goal_name, 'goalId' => $new_goal_id];
                $category_map[$new_cat_id] = ['name' => $default_goal_name, 'type' => 'savings'];
                // *** END: แก้ไข Logic การสร้างข้อมูลเริ่มต้น ***
            }
            
            // 3. ดึงเป้าหมายการออม (Savings Goals) - จะดึงข้อมูลล่าสุดเสมอ รวมถึงข้อมูลที่เพิ่งสร้าง
            $savingsGoals = [];
            $stmt_goals = $conn->prepare("SELECT goal_id, goal_name, target_amount FROM savings_goals WHERE profile_id = ?");
            $stmt_goals->bind_param("i", $profile_id);
            $stmt_goals->execute();
            $goals_result = $stmt_goals->get_result();
            while($row = $goals_result->fetch_assoc()) {
                 $savingsGoals[] = ['id' => (int)$row['goal_id'], 'name' => $row['goal_name'], 'amount' => (float)$row['target_amount']];
            }

            // *** START: ลบส่วน Logic ที่มีปัญหาออก ***
            // โค้ดส่วนที่เคยตรวจสอบและสร้าง "เงินออมทั่วไป" ซ้ำซ้อนได้ถูกย้ายเข้าไปรวมกับการสร้างโปรไฟล์ใหม่แล้ว
            // *** END: ลบส่วน Logic ที่มีปัญหาออก ***
            
            // 2. ดึงข้อมูลธุรกรรม (Transactions) ของปีที่เลือก
            $category_ids = array_keys($category_map);
            $transactions = [];
            if (!empty($category_ids)) {
                $ids_placeholder = implode(',', array_fill(0, count($category_ids), '?'));
                $sql = "SELECT category_id, transaction_month, amount, is_paid, note FROM transactions WHERE profile_id = ? AND transaction_year = ? AND category_id IN ($ids_placeholder)";
                $types = "ii" . str_repeat('i', count($category_ids));
                $params = array_merge([$profile_id, $year], $category_ids);
                $stmt_trans = $conn->prepare($sql);
                $stmt_trans->bind_param($types, ...$params);
                $stmt_trans->execute();
                $trans_result = $stmt_trans->get_result();
                while($row = $trans_result->fetch_assoc()) {
                    $transactions[$row['transaction_month']][$row['category_id']] = $row;
                }
            }

            $thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            $budgetData = [];
            for ($m = 1; $m <= 12; $m++) {
                $monthData = ['id' => $m, 'year' => $year, 'name' => $thaiMonths[$m - 1], 'paid' => [], 'notes' => []];
                foreach ($category_map as $cat_id => $details) {
                     $cat_name = $details['name'];
                     $monthData[$cat_name] = 0;
                     $monthData['paid'][$cat_name] = false;
                     $monthData['notes'][$cat_name] = '';
                }
                if (isset($transactions[$m])) {
                    foreach ($transactions[$m] as $cat_id => $trans) {
                        if(isset($category_map[$cat_id])) {
                           $cat_name = $category_map[$cat_id]['name'];
                           $monthData[$cat_name] = (float)$trans['amount'];
                           $monthData['paid'][$cat_name] = (bool)$trans['is_paid'];
                           $monthData['notes'][$cat_name] = $trans['note'];
                        }
                    }
                }
                $budgetData[] = $monthData;
            }
            
            // 4. ดึงรายการประจำ (Recurring Transactions)
            $recurringTransactions = [];
            $stmt_rec = $conn->prepare("SELECT rt.category_id, rt.amount FROM recurring_transactions rt JOIN categories c ON rt.category_id = c.category_id WHERE c.profile_id = ? AND c.is_active = 1");
            $stmt_rec->bind_param("i", $profile_id);
            $stmt_rec->execute();
            $rec_result = $stmt_rec->get_result();
            while($row = $rec_result->fetch_assoc()) {
                $recurringTransactions[$row['category_id']] = (float)$row['amount'];
            }

            // 5. รวบรวมข้อมูลทั้งหมดส่งกลับ
            echo json_encode([
                'success' => true,
                'data' => [
                    'budgetData' => $budgetData,
                    'columnStructure' => $columnStructure,
                    'expenseDueDates' => $expenseDueDates,
                    'incomeDueDates' => $incomeDueDates,
                    'savingsGoals' => $savingsGoals,
                    'recurringTransactions' => $recurringTransactions
                ]
            ]);
            break;

        // ===============================================
        //  POST: บันทึกข้อมูล (หลาย Endpoint)
        // ===============================================
        
        case 'save_transaction':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $category_id = (int)$input['categoryId'];
            $stmt_check = $conn->prepare("SELECT COUNT(*) FROM categories WHERE category_id = ? AND profile_id = ? AND is_active = 1");
            $stmt_check->bind_param("ii", $category_id, $profile_id);
            $stmt_check->execute();
            if ($stmt_check->get_result()->fetch_row()[0] == 0) {
                throw new Exception("Category ID does not belong to the current profile.");
            }
            $stmt = $conn->prepare("
                INSERT INTO transactions (profile_id, category_id, transaction_year, transaction_month, amount, is_paid, note) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE amount = VALUES(amount), is_paid = VALUES(is_paid), note = VALUES(note)
            ");
            $amount = (float)$input['amount'];
            $is_paid = (int)(bool)$input['is_paid'];
            $note = $input['note'] ?? '';
            $stmt->bind_param("iiiidis", $profile_id, $category_id, $input['year'], $input['monthId'], $amount, $is_paid, $note);
            $stmt->execute();
            echo json_encode(['success' => $stmt->affected_rows >= 0]);
            break;

        case 'add_category':
            if ($input['type'] === 'savings') {
                 throw new Exception("Savings categories must be created by adding a new Savings Goal.");
            }
            $profile_id = get_profile_id($conn, $input['profileName']);
            // Backend validation for duplicate name
            $stmt_check_dup = $conn->prepare("SELECT COUNT(*) FROM categories WHERE profile_id = ? AND category_name = ? AND is_active = 1");
            $stmt_check_dup->bind_param("is", $profile_id, $input['name']);
            $stmt_check_dup->execute();
            if ($stmt_check_dup->get_result()->fetch_row()[0] > 0) {
                 throw new Exception("A category with this name already exists.");
            }
            
            $stmt_order = $conn->prepare("SELECT MAX(display_order) as max_order FROM categories WHERE profile_id = ? AND category_type = ?");
            $stmt_order->bind_param("is", $profile_id, $input['type']);
            $stmt_order->execute();
            $max_order = $stmt_order->get_result()->fetch_assoc()['max_order'];
            $new_order = ($max_order === null) ? 0 : $max_order + 1;
            
            $stmt = $conn->prepare("INSERT INTO categories (profile_id, category_name, category_type, display_order) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("issi", $profile_id, $input['name'], $input['type'], $new_order);
            if($stmt->execute()) {
                 echo json_encode([
                    'success' => true, 
                    'newCategory' => ['id' => $stmt->insert_id, 'name' => $input['name'], 'type' => $input['type']]
                ]);
            } else {
                 throw new Exception("Could not add category.");
            }
            break;

        case 'delete_category':
             $profile_id = get_profile_id($conn, $input['profileName']);
             $category_id = (int)$input['categoryId'];
             // Check category type before deleting
             $stmt_check = $conn->prepare("SELECT category_type FROM categories WHERE category_id = ? AND profile_id = ?");
             $stmt_check->bind_param("ii", $category_id, $profile_id);
             $stmt_check->execute();
             $result = $stmt_check->get_result();
             if ($result->num_rows == 0) { throw new Exception("Category not found or does not belong to this profile."); }
             $category_type = $result->fetch_assoc()['category_type'];
             if ($category_type === 'savings') {
                 throw new Exception("Savings categories cannot be deleted directly. Please delete the corresponding Savings Goal instead.");
             }
             // Use ON DELETE CASCADE in DB to handle related data
             $stmt = $conn->prepare("DELETE FROM categories WHERE category_id = ?");
             $stmt->bind_param("i", $category_id);
             $stmt->execute();
             echo json_encode(['success' => $stmt->affected_rows > 0]);
             break;

        case 'update_category_name':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $category_id = (int)$input['categoryId'];
            $newName = $input['newName'];
            // Check category type
            $stmt_check = $conn->prepare("SELECT category_type FROM categories WHERE category_id = ? AND profile_id = ?");
            $stmt_check->bind_param("ii", $category_id, $profile_id);
            $stmt_check->execute();
            $category_type = $stmt_check->get_result()->fetch_assoc()['category_type'] ?? null;
            if ($category_type === 'savings') {
                 throw new Exception("Savings category names are managed by their corresponding Savings Goal.");
            }
            // Check for duplicate name
            $stmt_check_dup = $conn->prepare("SELECT COUNT(*) FROM categories WHERE profile_id = ? AND category_name = ? AND category_id != ? AND is_active = 1");
            $stmt_check_dup->bind_param("isi", $profile_id, $newName, $category_id);
            $stmt_check_dup->execute();
            if ($stmt_check_dup->get_result()->fetch_row()[0] > 0) {
                 throw new Exception("A category with this name already exists.");
            }
            $stmt = $conn->prepare("UPDATE categories SET category_name = ? WHERE category_id = ? AND profile_id = ?");
            $stmt->bind_param("sii", $newName, $category_id, $profile_id);
            $stmt->execute();
            echo json_encode(['success' => $stmt->affected_rows > 0]);
            break;
            
        case 'update_category_order':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $conn->begin_transaction();
            try {
                $stmt = $conn->prepare("UPDATE categories SET display_order = ? WHERE category_id = ? AND profile_id = ?");
                foreach($input['categoryIds'] as $index => $categoryId) {
                    $stmt->bind_param("iii", $index, (int)$categoryId, $profile_id);
                    $stmt->execute();
                }
                $conn->commit();
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                $conn->rollback();
                throw $e;
            }
            break;
        
        // *** START: แก้ไขโค้ดส่วนนี้ทั้งหมด ***
        case 'save_due_dates':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $conn->begin_transaction();
            try {
                // เตรียม 2 คำสั่ง: 1.สำหรับอัปเดตค่า 2.สำหรับล้างค่าเป็น NULL
                $stmt_update = $conn->prepare("UPDATE categories SET due_day = ? WHERE category_id = ? AND profile_id = ?");
                $stmt_clear = $conn->prepare("UPDATE categories SET due_day = NULL WHERE category_id = ? AND profile_id = ?");

                // ตรวจสอบว่าการเตรียมคำสั่งสำเร็จหรือไม่
                if (!$stmt_update || !$stmt_clear) {
                    throw new Exception("Database statement preparation failed: " . $conn->error);
                }

                 foreach($input['dates'] as $categoryId => $day) {
                    $catIdInt = (int)$categoryId;
                    
                    // ตรวจสอบว่าค่าที่ส่งมาเป็นตัวเลขที่ถูกต้อง (1-31) หรือไม่
                    if (is_numeric($day) && $day >= 1 && $day <= 31) {
                        // ถ้าถูกต้อง: ใชคำสั่ง update
                        $due_day = (int)$day;
                        $stmt_update->bind_param("iii", $due_day, $catIdInt, $profile_id);
                        $stmt_update->execute();
                    } else {
                        // ถ้าไม่ถูกต้อง (ค่าว่าง, ตัวอักษร, หรือเลขนอกช่วง): ใช้คำสั่ง clear
                        $stmt_clear->bind_param("ii", $catIdInt, $profile_id);
                        $stmt_clear->execute();
                    }
                 }
                 
                 // ปิด statement ที่เตรียมไว้
                 $stmt_update->close();
                 $stmt_clear->close();
                 
                 $conn->commit();
                 echo json_encode(['success' => true]);

            } catch (Exception $e) {
                $conn->rollback();
                throw $e;
            }
            break;
        // *** END: แก้ไขโค้ดส่วนนี้ทั้งหมด ***

        case 'save_recurring':
             $profile_id = get_profile_id($conn, $input['profileName']);
             $conn->begin_transaction();
             try {
                $stmt_upsert = $conn->prepare("INSERT INTO recurring_transactions(category_id, amount) VALUES (?,?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)");
                $stmt_del = $conn->prepare("DELETE FROM recurring_transactions WHERE category_id = ?");
                // Verify categories belong to profile before saving
                $categoryIds = array_keys($input['recurringData']);
                if (!empty($categoryIds)) {
                    $ids_placeholder = implode(',', array_fill(0, count($categoryIds), '?'));
                    $types = "i" . str_repeat('i', count($categoryIds));
                    $params = array_merge([$profile_id], $categoryIds);
                    $stmt_verify = $conn->prepare("SELECT category_id FROM categories WHERE profile_id = ? AND category_id IN ($ids_placeholder)");
                    $stmt_verify->bind_param($types, ...$params);
                    $stmt_verify->execute();
                    $verified_ids = array_flip(array_column($stmt_verify->get_result()->fetch_all(MYSQLI_NUM), 0));
                    foreach($input['recurringData'] as $categoryId => $amount) {
                        if (!isset($verified_ids[$categoryId])) continue; // Skip if category not verified
                        $amount_float = (float)$amount;
                        if($amount_float > 0) {
                             $stmt_upsert->bind_param("id", $categoryId, $amount_float);
                             $stmt_upsert->execute();
                        } else {
                             $stmt_del->bind_param("i", $categoryId);
                             $stmt_del->execute();
                        }
                    }
                }
                $conn->commit();
                echo json_encode(['success' => true]);
             } catch (Exception $e) {
                $conn->rollback();
                throw $e;
             }
             break;

        case 'save_savings_goal':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $goalId = $input['id'] ?? null;
            $goalName = $input['name'];
            $targetAmount = (float)$input['amount'];
            $conn->begin_transaction();
            try {
                if($goalId) { // Update
                    // Check for duplicate name
                    $stmt_check = $conn->prepare("SELECT COUNT(*) FROM savings_goals WHERE profile_id = ? AND goal_name = ? AND goal_id != ?");
                    $stmt_check->bind_param("isi", $profile_id, $goalName, $goalId);
                    $stmt_check->execute();
                    if ($stmt_check->get_result()->fetch_row()[0] > 0) {
                         throw new Exception("A savings goal with this name already exists.");
                    }
                    $stmt_goal = $conn->prepare("UPDATE savings_goals SET goal_name = ?, target_amount = ? WHERE goal_id = ? AND profile_id = ?");
                    $stmt_goal->bind_param("sdii", $goalName, $targetAmount, $goalId, $profile_id);
                    $stmt_goal->execute();
                    $stmt_cat = $conn->prepare("UPDATE categories SET category_name = ? WHERE goal_id = ? AND profile_id = ?");
                    $stmt_cat->bind_param("sii", $goalName, $goalId, $profile_id);
                    $stmt_cat->execute();
                    $conn->commit();
                    echo json_encode(['success' => true, 'id' => $goalId]);
                } else { // Insert
                    // Check for duplicate name
                     $stmt_check = $conn->prepare("SELECT COUNT(*) FROM savings_goals WHERE profile_id = ? AND goal_name = ?");
                    $stmt_check->bind_param("is", $profile_id, $goalName);
                    $stmt_check->execute();
                    if ($stmt_check->get_result()->fetch_row()[0] > 0) {
                         throw new Exception("A savings goal with this name already exists.");
                    }
                    $stmt_goal = $conn->prepare("INSERT INTO savings_goals (profile_id, goal_name, target_amount) VALUES (?, ?, ?)");
                    $stmt_goal->bind_param("isd", $profile_id, $goalName, $targetAmount);
                    $stmt_goal->execute();
                    $newGoalId = $stmt_goal->insert_id;
                    $stmt_order = $conn->prepare("SELECT MAX(display_order) as max_order FROM categories WHERE profile_id = ? AND category_type = 'savings'");
                    $stmt_order->bind_param("i", $profile_id);
                    $stmt_order->execute();
                    $max_order = $stmt_order->get_result()->fetch_assoc()['max_order'];
                    $new_order = ($max_order === null) ? 0 : $max_order + 1;
                    $stmt_cat = $conn->prepare("INSERT INTO categories (profile_id, goal_id, category_name, category_type, display_order) VALUES (?, ?, ?, 'savings', ?)");
                    $stmt_cat->bind_param("iisi", $profile_id, $newGoalId, $goalName, $new_order);
                    $stmt_cat->execute();
                    $newCategoryId = $stmt_cat->insert_id;
                    $conn->commit();
                    echo json_encode([
                        'success' => true, 
                        'newGoal' => ['id' => $newGoalId, 'name' => $goalName, 'amount' => $targetAmount],
                        'newCategory' => ['id' => $newCategoryId, 'name' => $goalName, 'type' => 'savings', 'goalId' => $newGoalId]
                    ]);
                }
            } catch (Exception $e) {
                $conn->rollback();
                throw $e;
            }
            break;

        case 'delete_savings_goal':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $goalId = (int)$input['id'];
            $conn->begin_transaction();
            try {
                // Deactivate category instead of deleting to preserve transaction history
                $stmt_cat = $conn->prepare("UPDATE categories SET is_active = 0 WHERE goal_id = ? AND profile_id = ?");
                $stmt_cat->bind_param("ii", $goalId, $profile_id);
                $stmt_cat->execute();
                // Then delete the goal itself
                $stmt_goal = $conn->prepare("DELETE FROM savings_goals WHERE goal_id = ? AND profile_id = ?");
                $stmt_goal->bind_param("ii", $goalId, $profile_id);
                $stmt_goal->execute();
                $conn->commit();
                echo json_encode(['success' => $stmt_goal->affected_rows > 0]);
            } catch (Exception $e) {
                $conn->rollback();
                throw $e;
            }
            break;

        default:
            throw new Exception('Invalid API Action.');
            break;
    }
} catch (Exception $e) {
    http_response_code(400); 
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

$conn->close();
?>

