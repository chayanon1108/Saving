<?php
// Budget Tracker Pro - Database Configuration

// -- ตั้งค่าการเชื่อมต่อฐานข้อมูล --
// กรุณาแก้ไขค่าเหล่านี้ให้ตรงกับการตั้งค่าเซิร์ฟเวอร์ของคุณ
$servername = "localhost";    // หรือ IP ของเซิร์ฟเวอร์ฐานข้อมูล
$username = "root";           // ชื่อผู้ใช้สำหรับเข้าฐานข้อมูล
$password = "";               // รหัสผ่านสำหรับเข้าฐานข้อมูล
$dbname = "saving_db";        // *** แก้ไข: เปลี่ยนชื่อฐานข้อมูลให้ตรงกับไฟล์ .sql ***

// -- สร้างการเชื่อมต่อ --
$conn = new mysqli($servername, $username, $password, $dbname);

// -- ตรวจสอบการเชื่อมต่อ --
if ($conn->connect_error) {
    // หยุดการทำงานและแสดงข้อความข้อผิดพลาดในรูปแบบ JSON
    header('Content-Type: application/json');
    http_response_code(500); // Internal Server Error
    die(json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $conn->connect_error
    ]));
}

// -- ตั้งค่าการเข้ารหัสตัวอักษรเป็น UTF-8 --
// เพื่อให้รองรับภาษาไทยได้อย่างถูกต้อง
if (!$conn->set_charset("utf8")) {
    // หากตั้งค่าไม่ได้ ให้แสดงข้อผิดพลาด
    header('Content-Type: application/json');
    http_response_code(500);
    die(json_encode([
        'success' => false,
        'message' => 'Error loading character set utf8: ' . $conn->error
    ]));
}

?>
