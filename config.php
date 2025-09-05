<?php
// Budget Tracker Pro - Database Configuration for Render.com (Final Version)

header('Content-Type: application/json');
// ปิดการแสดง error บนหน้าเว็บเพื่อความปลอดภัย แต่ยังสามารถดู log ได้บน Render
ini_set('display_errors', 0); 
error_reporting(E_ALL);

// ดึงค่า Connection URL ที่เราตั้งไว้ใน Environment Variable ของ Render
$database_url_str = getenv('DATABASE_URL');

if ($database_url_str === false) {
    http_response_code(500);
    die(json_encode([
        'success' => false,
        'message' => 'Database connection URL not found. Please set the DATABASE_URL environment variable.'
    ]));
}

try {
    // แยกส่วนประกอบของ URL เพื่อนำไปใช้เชื่อมต่อ
    $db_parts = parse_url($database_url_str);

    $host = $db_parts['host'];
    $port = $db_parts['port'];
    $user = $db_parts['user'];
    $pass = $db_parts['pass'];
    // ตัดเครื่องหมาย / ที่นำหน้าชื่อ database ออก
    $dbname = ltrim($db_parts['path'], '/');

    // สร้าง DSN (Data Source Name) สำหรับการเชื่อมต่อ PostgreSQL
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";

    // เพิ่ม Options ที่จำเป็นสำหรับการเชื่อมต่อที่เสถียรและปลอดภัย
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    // สร้างการเชื่อมต่อด้วย PDO ซึ่งรองรับ PostgreSQL
    $conn = new PDO($dsn, $user, $pass, $options);
    
} catch (PDOException $e) {
    http_response_code(500);
    // บันทึก error ไว้ใน log ของเซิร์ฟเวอร์ แทนที่จะแสดงให้ผู้ใช้เห็น
    error_log('Database Connection Error: ' . $e->getMessage());
    die(json_encode([
        'success' => false,
        'message' => 'A server error occurred during database connection. Please check server logs.'
    ]));
}
?>

