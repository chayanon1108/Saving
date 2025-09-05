# ใช้ Image พื้นฐานของ PHP 8.1 ที่มี Apache ติดตั้งมาให้
FROM php:8.1-apache

# เปิดใช้งานส่วนเสริมที่จำเป็น (mysqli สำหรับฐานข้อมูลเดิม และ pdo/pdo_pgsql สำหรับ PostgreSQL) และเปิดใช้งาน mod_rewrite
RUN docker-php-ext-install mysqli pdo pdo_pgsql && a2enmod rewrite

# คัดลอกไฟล์ตั้งค่า Apache ที่เราสร้างขึ้นเข้าไปในตำแหน่งที่ถูกต้อง
COPY apache-config.conf /etc/apache2/conf-available/custom-php-config.conf

# เปิดใช้งานไฟล์ตั้งค่าที่เราเพิ่งคัดลอกไป
RUN a2enconf custom-php-config

# คัดลอกโค้ดทั้งหมดจากโปรเจกต์ของคุณเข้าไปในเซิร์ฟเวอร์
COPY . /var/www/html/

# สร้างไฟล์ตั้งค่า PHP เพื่อให้แสดง Error ลงใน Log โดยตรง (เผื่อมีปัญหาอื่น)
RUN echo "error_reporting = E_ALL" >> /usr/local/etc/php/php.ini-production && \
    echo "display_errors = Off" >> /usr/local/etc/php/php.ini-production && \
    echo "log_errors = On" >> /usr/local/etc/php/php.ini-production

# เปิด Port 80 ให้เว็บเซิร์ฟเวอร์ทำงาน
EXPOSE 80

