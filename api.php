<?php
// Budget Tracker Pro - Main API for Render.com (Final Corrected Version)
header('Content-Type: application/json');
require 'config.php'; // เรียกใช้ไฟล์ config ที่มีฟังก์ชันเชื่อมต่อ

// *** จุดแก้ไขที่สำคัญที่สุด ***
// เรียกใช้ฟังก์ชันเพื่อเชื่อมต่อและรับค่า $conn มาเก็บไว้ในตัวแปร
$conn = connect_to_database();

// รับค่าจาก request (เหมือนเดิม)
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

// ฟังก์ชันสำหรับดึง profile_id (แปลงเป็น PDO)
function get_profile_id($conn, $profile_name) {
    if (empty($profile_name)) {
        throw new Exception("Profile name cannot be empty.");
    }
    $stmt = $conn->prepare("SELECT profile_id FROM profiles WHERE profile_name = ?");
    $stmt->execute([$profile_name]);
    $profile = $stmt->fetch();

    if ($profile) {
        return $profile['profile_id'];
    } else {
        $stmt = $conn->prepare("INSERT INTO profiles (profile_name) VALUES (?)");
        $stmt->execute([$profile_name]);
        return $conn->lastInsertId('profiles_profile_id_seq');
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $conn->beginTransaction();
    }

    switch ($action) {
        case 'get_all_data':
            $profile_name = $_GET['profile'] ?? 'default';
            $year = (int)($_GET['year'] ?? date('Y') + 543);
            
            $profile_id = get_profile_id($conn, $profile_name);

            // Logic ทั้งหมดที่เหลือเหมือนเดิมทุกประการ เพราะตอนนี้ $conn ใช้งานได้แล้ว
            $stmt_cat = $conn->prepare("SELECT category_id, category_name, category_type, due_day, goal_id FROM categories WHERE profile_id = ? AND is_active = 1 ORDER BY category_type, display_order ASC");
            $stmt_cat->execute([$profile_id]);
            $categories_result = $stmt_cat->fetchAll();

            $columnStructure = ['income' => [], 'expense' => [], 'savings' => []];
            $expenseDueDates = []; $incomeDueDates = []; $category_map = [];
            
            foreach($categories_result as $row) {
                $category_item = ['id' => (int)$row['category_id'], 'name' => $row['category_name']];
                if ($row['category_type'] === 'savings') $category_item['goalId'] = $row['goal_id'] ? (int)$row['goal_id'] : null;
                $columnStructure[$row['category_type']][] = $category_item;
                $category_map[$row['category_id']] = ['name' => $row['category_name'], 'type' => $row['category_type']];
                if ($row['due_day']) {
                    if ($row['category_type'] === 'income') $incomeDueDates[$row['category_id']] = $row['due_day'];
                    else $expenseDueDates[$row['category_id']] = $row['due_day'];
                }
            }
            
            $savingsGoals = [];
            $stmt_goals = $conn->prepare("SELECT goal_id, goal_name, target_amount FROM savings_goals WHERE profile_id = ?");
            $stmt_goals->execute([$profile_id]);
            foreach($stmt_goals->fetchAll() as $row) $savingsGoals[] = ['id' => (int)$row['goal_id'], 'name' => $row['goal_name'], 'amount' => (float)$row['target_amount']];
            
            $transactions = [];
            $category_ids = array_keys($category_map);
            if (!empty($category_ids)) {
                $placeholders = implode(',', array_fill(0, count($category_ids), '?'));
                $sql = "SELECT category_id, transaction_month, amount, is_paid, note FROM transactions WHERE profile_id = ? AND transaction_year = ? AND category_id IN ($placeholders)";
                $params = array_merge([$profile_id, $year], $category_ids);
                $stmt_trans = $conn->prepare($sql);
                $stmt_trans->execute($params);
                foreach($stmt_trans->fetchAll() as $row) $transactions[$row['transaction_month']][$row['category_id']] = $row;
            }

            $thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            $budgetData = [];
            for ($m = 1; $m <= 12; $m++) {
                $monthData = ['id' => $m, 'year' => $year, 'name' => $thaiMonths[$m - 1], 'paid' => [], 'notes' => []];
                foreach ($category_map as $cat_id => $details) {
                     $cat_name = $details['name'];
                     $monthData[$cat_name] = (float)($transactions[$m][$cat_id]['amount'] ?? 0);
                     $monthData['paid'][$cat_name] = (bool)($transactions[$m][$cat_id]['is_paid'] ?? false);
                     $monthData['notes'][$cat_name] = $transactions[$m][$cat_id]['note'] ?? '';
                }
                $budgetData[] = $monthData;
            }
            
            $recurringTransactions = [];
            $stmt_rec = $conn->prepare("SELECT rt.category_id, rt.amount FROM recurring_transactions rt JOIN categories c ON rt.category_id = c.category_id WHERE c.profile_id = ? AND c.is_active = 1");
            $stmt_rec->execute([$profile_id]);
            foreach($stmt_rec->fetchAll() as $row) $recurringTransactions[$row['category_id']] = (float)$row['amount'];

            echo json_encode(['success' => true, 'data' => [
                'budgetData' => $budgetData, 'columnStructure' => $columnStructure,
                'expenseDueDates' => $expenseDueDates, 'incomeDueDates' => $incomeDueDates,
                'savingsGoals' => $savingsGoals, 'recurringTransactions' => $recurringTransactions
            ]]);
            break;
        
        // POST Handlers converted to PDO
        case 'save_transaction':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $sql = "INSERT INTO transactions (profile_id, category_id, transaction_year, transaction_month, amount, is_paid, note) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (profile_id, category_id, transaction_year, transaction_month) DO UPDATE SET amount = EXCLUDED.amount, is_paid = EXCLUDED.is_paid, note = EXCLUDED.note";
            $stmt = $conn->prepare($sql);
            $stmt->execute([ $profile_id, (int)$input['categoryId'], (int)$input['year'], (int)$input['monthId'], (float)$input['amount'], (int)(bool)$input['is_paid'], $input['note'] ?? '' ]);
            echo json_encode(['success' => true]);
            break;
        
        case 'add_category':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $stmt_order = $conn->prepare("SELECT MAX(display_order) as max_order FROM categories WHERE profile_id = ? AND category_type = ?::category_type_enum");
            $stmt_order->execute([$profile_id, $input['type']]);
            $max_order = $stmt_order->fetchColumn();
            $new_order = ($max_order === null) ? 0 : $max_order + 1;
            
            $stmt = $conn->prepare("INSERT INTO categories (profile_id, category_name, category_type, display_order) VALUES (?, ?, ?::category_type_enum, ?)");
            $stmt->execute([$profile_id, $input['name'], $input['type'], $new_order]);
            $new_id = $conn->lastInsertId('categories_category_id_seq');
            echo json_encode(['success' => true, 'newCategory' => ['id' => $new_id, 'name' => $input['name'], 'type' => $input['type']]]);
            break;

        case 'delete_category':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $stmt = $conn->prepare("DELETE FROM categories WHERE category_id = ? AND profile_id = ? AND category_type != 'savings'");
            $stmt->execute([(int)$input['categoryId'], $profile_id]);
            echo json_encode(['success' => $stmt->rowCount() > 0]);
            break;

        case 'update_category_name':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $stmt = $conn->prepare("UPDATE categories SET category_name = ? WHERE category_id = ? AND profile_id = ? AND category_type != 'savings'");
            $stmt->execute([$input['newName'], (int)$input['categoryId'], $profile_id]);
            echo json_encode(['success' => $stmt->rowCount() > 0]);
            break;
            
        case 'update_category_order':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $stmt = $conn->prepare("UPDATE categories SET display_order = ? WHERE category_id = ? AND profile_id = ?");
            foreach($input['categoryIds'] as $index => $categoryId) {
                $stmt->execute([$index, (int)$categoryId, $profile_id]);
            }
            echo json_encode(['success' => true]);
            break;
        
        case 'save_due_dates':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $stmt = $conn->prepare("UPDATE categories SET due_day = ? WHERE category_id = ? AND profile_id = ?");
             foreach($input['dates'] as $categoryId => $day) {
                $due_day = (is_numeric($day) && $day >= 1 && $day <= 31) ? (int)$day : null;
                $stmt->execute([$due_day, (int)$categoryId, $profile_id]);
             }
             echo json_encode(['success' => true]);
            break;

        case 'save_recurring':
             $profile_id = get_profile_id($conn, $input['profileName']);
             $sql_upsert = "INSERT INTO recurring_transactions(category_id, amount) VALUES (?,?) ON CONFLICT (category_id) DO UPDATE SET amount = EXCLUDED.amount";
             $sql_del = "DELETE FROM recurring_transactions WHERE category_id = ?";
             $stmt_upsert = $conn->prepare($sql_upsert);
             $stmt_del = $conn->prepare($sql_del);
             
             foreach($input['recurringData'] as $categoryId => $amount) {
                $amount_float = (float)$amount;
                if($amount_float > 0) {
                     $stmt_upsert->execute([(int)$categoryId, $amount_float]);
                } else {
                     $stmt_del->execute([(int)$categoryId]);
                }
             }
             echo json_encode(['success' => true]);
             break;

        case 'save_savings_goal':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $goalId = $input['id'] ?? null;
            $goalName = $input['name'];
            $targetAmount = (float)$input['amount'];
            
            if($goalId) { // Update
                $stmt_goal = $conn->prepare("UPDATE savings_goals SET goal_name = ?, target_amount = ? WHERE goal_id = ? AND profile_id = ?");
                $stmt_goal->execute([$goalName, $targetAmount, (int)$goalId, $profile_id]);
                $stmt_cat = $conn->prepare("UPDATE categories SET category_name = ? WHERE goal_id = ? AND profile_id = ?");
                $stmt_cat->execute([$goalName, (int)$goalId, $profile_id]);
                echo json_encode(['success' => true, 'id' => $goalId]);
            } else { // Insert
                $stmt_goal = $conn->prepare("INSERT INTO savings_goals (profile_id, goal_name, target_amount) VALUES (?, ?, ?)");
                $stmt_goal->execute([$profile_id, $goalName, $targetAmount]);
                $newGoalId = $conn->lastInsertId('savings_goals_goal_id_seq');
                
                $stmt_cat = $conn->prepare("INSERT INTO categories (profile_id, goal_id, category_name, category_type) VALUES (?, ?, ?, 'savings')");
                $stmt_cat->execute([$profile_id, $newGoalId, $goalName]);
                $newCategoryId = $conn->lastInsertId('categories_category_id_seq');

                echo json_encode([
                    'success' => true, 
                    'newGoal' => ['id' => $newGoalId, 'name' => $goalName, 'amount' => $targetAmount],
                    'newCategory' => ['id' => $newCategoryId, 'name' => $goalName, 'type' => 'savings', 'goalId' => $newGoalId]
                ]);
            }
            break;

        case 'delete_savings_goal':
            $profile_id = get_profile_id($conn, $input['profileName']);
            $goalId = (int)$input['id'];
            $stmt_cat = $conn->prepare("UPDATE categories SET is_active = 0 WHERE goal_id = ? AND profile_id = ?");
            $stmt_cat->execute([$goalId, $profile_id]);
            $stmt_goal = $conn->prepare("DELETE FROM savings_goals WHERE goal_id = ? AND profile_id = ?");
            $stmt_goal->execute([$goalId, $profile_id]);
            echo json_encode(['success' => $stmt_goal->rowCount() > 0]);
            break;
        
        default:
            throw new Exception('Invalid API Action.');
            break;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $conn->inTransaction()) {
        $conn->commit();
    }

} catch (Exception $e) {
    if ($conn && $conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(400); 
    error_log('API Exception: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>

