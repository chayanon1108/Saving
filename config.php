<?php
// Budget Tracker Pro - Database Configuration for Render.com (Final Corrected Version)

// ปิดการแสดง error บนหน้าเว็บเพื่อความปลอดภัย แต่ยังสามารถดู log ได้บน Render
ini_set('display_errors', 0); 
error_reporting(E_ALL);

function connect_to_database() {
    // ดึงค่า Connection URL ที่เราตั้งไว้ใน Environment Variable ของ Render
    $database_url_str = getenv('DATABASE_URL');

    if ($database_url_str === false) {
        // ถ้าหา URL ไม่เจอ ให้ log error และหยุดการทำงาน
        error_log('Database connection URL not found. Please set the DATABASE_URL environment variable.');
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Internal Server Error: DB Config missing.']);
        exit;
    }

    try {
        // แยกส่วนประกอบของ URL เพื่อนำไปใช้เชื่อมต่อ
        $db_parts = parse_url($database_url_str);

        $host = $db_parts['host'];
        $port = $db_parts['port'];
        $user = $db_parts['user'];
        $pass = $db_parts['pass'];
        $dbname = ltrim($db_parts['path'], '/');

        $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        // สร้างการเชื่อมต่อด้วย PDO
        $conn = new PDO($dsn, $user, $pass, $options);
        
        // คืนค่าการเชื่อมต่อที่สำเร็จออกไป
        return $conn;
        
    } catch (PDOException $e) {
        // บันทึก error ไว้ใน log ของเซิร์ฟเวอร์
        error_log('Database Connection Error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Internal Server Error: DB Connection failed.']);
        exit;
    }
}

?>

