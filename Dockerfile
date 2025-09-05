# ใช้ Image พื้นฐานของ PHP 8.1 ที่มี Apache ติดตั้งมาให้
FROM php:8.1-apache

# เปิดใช้งานส่วนเสริม mysqli และ mod_rewrite สำหรับ Apache
RUN docker-php-ext-install mysqli && a2enmod rewrite

# คัดลอกโค้ดทั้งหมดจากโปรเจกต์ของคุณเข้าไปในเซิร์ฟเวอร์
COPY . /var/www/html/

# (เพิ่มเข้ามาใหม่) สร้างไฟล์ตั้งค่า PHP เพื่อให้แสดง Error ลงใน Log โดยตรง
RUN echo "error_reporting = E_ALL" >> /usr/local/etc/php/php.ini-production && \
    echo "display_errors = Off" >> /usr/local/etc/php/php.ini-production && \
    echo "log_errors = On" >> /usr/local/etc/php/php.ini-production

# เปิด Port 80 ให้เว็บเซิร์ฟเวอร์ทำงาน
EXPOSE 80

