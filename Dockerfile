# ใช้ Image พื้นฐานของ PHP 8.1 ที่มี Apache ติดตั้งมาให้
FROM php:8.1-apache

# (เพิ่มเข้ามาใหม่) อัปเดต list ของ package และติดตั้งเครื่องมือที่จำเป็นสำหรับ PostgreSQL (libpq-dev)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    && docker-php-ext-configure pgsql -with-pgsql=/usr/local/pgsql \
    && docker-php-ext-install pdo pdo_pgsql

# เปิดใช้งาน mod_rewrite สำหรับ Apache
RUN a2enmod rewrite

# คัดลอกไฟล์ตั้งค่า Apache ที่เราสร้างขึ้นเข้าไปในตำแหน่งที่ถูกต้อง
COPY apache-config.conf /etc/apache2/conf-available/custom-php-config.conf

# เปิดใช้งานไฟล์ตั้งค่าที่เราเพิ่งคัดลอกไป
RUN a2enconf custom-php-config

# คัดลอกโค้ดทั้งหมดจากโปรเจกต์ของคุณเข้าไปในเซิร์ฟเวอร์
COPY . /var/www/html/

# สร้างไฟล์ตั้งค่า PHP เพื่อให้แสดง Error ลงใน Log โดยตรง
RUN echo "error_reporting = E_ALL" >> /usr/local/etc/php/php.ini-production && \
    echo "display_errors = Off" >> /usr/local/etc/php/php.ini-production && \
    echo "log_errors = On" >> /usr/local/etc/php/php.ini-production

# เปิด Port 80 ให้เว็บเซิร์ฟเวอร์ทำงาน
EXPOSE 80

