# ใช้ Image พื้นฐานของ PHP 8.1 ที่มี Apache ติดตั้งมาให้
FROM php:8.1-apache

# เปิดใช้งานส่วนเสริม mysqli เพื่อให้เชื่อมต่อกับฐานข้อมูลได้
RUN docker-php-ext-install mysqli && a2enmod rewrite

# คัดลอกโค้ดทั้งหมดจากโปรเจกต์ของคุณเข้าไปในเซิร์ฟเวอร์
COPY . /var/www/html/

# เปิด Port 80 ให้เว็บเซิร์ฟเวอร์ทำงาน
EXPOSE 80
