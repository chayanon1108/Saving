-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 05, 2025 at 10:00 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `saving_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `category_id` int(11) NOT NULL,
  `profile_id` int(11) NOT NULL,
  `goal_id` int(11) DEFAULT NULL,
  `category_name` varchar(255) NOT NULL,
  `category_type` enum('income','expense','savings') NOT NULL,
  `display_order` int(11) DEFAULT 0,
  `due_day` tinyint(2) UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`category_id`, `profile_id`, `goal_id`, `category_name`, `category_type`, `display_order`, `due_day`, `is_active`, `created_at`) VALUES
(1, 1, NULL, 'เงินเดือนปอ', 'income', 0, NULL, 1, '2025-09-05 05:46:40'),
(2, 1, NULL, 'เงินเดือนเบญ', 'income', 1, NULL, 1, '2025-09-05 05:46:40'),
(3, 1, NULL, 'ค่าบ้าน', 'expense', 0, NULL, 1, '2025-09-05 05:46:40'),
(4, 1, NULL, 'ค่ารถ', 'expense', 1, NULL, 1, '2025-09-05 05:46:40'),
(5, 1, NULL, 'ค่าใช้จ่ายส่วนตัว', 'expense', 2, NULL, 1, '2025-09-05 05:46:40'),
(6, 1, 1, 'เงินออมทั่วไป', 'savings', 0, NULL, 1, '2025-09-05 05:46:40'),
(7, 1, NULL, 'เงินเที่ยว', 'savings', 1, NULL, 0, '2025-09-05 05:47:11'),
(9, 1, NULL, 'เงินพิเศษ', 'income', 2, NULL, 1, '2025-09-05 05:54:24'),
(10, 2, NULL, 'เงินเดือนปอ', 'income', 0, 31, 1, '2025-09-05 06:13:20'),
(11, 2, NULL, 'เงินเดือนเบญ', 'income', 1, NULL, 1, '2025-09-05 06:13:20'),
(12, 2, NULL, 'ค่าบ้าน', 'expense', 0, 31, 1, '2025-09-05 06:13:20'),
(13, 2, NULL, 'ค่ารถ', 'expense', 1, 12, 1, '2025-09-05 06:13:20'),
(14, 2, NULL, 'Shopee', 'expense', 2, NULL, 1, '2025-09-05 06:13:20'),
(15, 2, NULL, 'เงินออมทั่วไป', 'savings', 0, NULL, 0, '2025-09-05 06:13:20'),
(16, 2, 4, 'เงินออม', 'savings', 1, NULL, 1, '2025-09-05 06:20:44'),
(17, 2, NULL, 'ดอกป้าหลิน', 'income', 2, NULL, 1, '2025-09-05 07:02:40'),
(18, 2, NULL, 'เงินพิเศษ', 'income', 3, NULL, 1, '2025-09-05 07:03:00'),
(19, 2, NULL, 'เงินพ่อ', 'income', 4, NULL, 1, '2025-09-05 07:03:36'),
(20, 2, NULL, 'เงินสด Shopee', 'expense', 3, 5, 1, '2025-09-05 07:04:33'),
(21, 2, NULL, 'Lazada', 'expense', 4, 5, 1, '2025-09-05 07:05:05');

-- --------------------------------------------------------

--
-- Table structure for table `profiles`
--

CREATE TABLE `profiles` (
  `profile_id` int(11) NOT NULL,
  `profile_name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `profiles`
--

INSERT INTO `profiles` (`profile_id`, `profile_name`, `created_at`) VALUES
(1, 'Saving', '2025-09-05 05:46:40'),
(2, 'Por & Ben', '2025-09-05 06:13:20');

-- --------------------------------------------------------

--
-- Table structure for table `recurring_transactions`
--

CREATE TABLE `recurring_transactions` (
  `category_id` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `recurring_transactions`
--

INSERT INTO `recurring_transactions` (`category_id`, `amount`, `updated_at`) VALUES
(1, 18550.00, '2025-09-05 05:56:39'),
(10, 18550.00, '2025-09-05 06:52:27'),
(11, 9000.00, '2025-09-05 06:52:27');

-- --------------------------------------------------------

--
-- Table structure for table `savings_goals`
--

CREATE TABLE `savings_goals` (
  `goal_id` int(11) NOT NULL,
  `profile_id` int(11) NOT NULL,
  `goal_name` varchar(255) NOT NULL,
  `target_amount` decimal(15,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `savings_goals`
--

INSERT INTO `savings_goals` (`goal_id`, `profile_id`, `goal_name`, `target_amount`, `created_at`) VALUES
(1, 1, 'เงินออมทั่วไป', 0.00, '2025-09-05 05:46:40'),
(4, 2, 'เงินออม', 50000.00, '2025-09-05 06:20:44');

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `profile_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `transaction_year` int(11) NOT NULL,
  `transaction_month` int(11) NOT NULL,
  `amount` decimal(15,2) DEFAULT 0.00,
  `is_paid` tinyint(1) DEFAULT 0,
  `note` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `transactions`
--

INSERT INTO `transactions` (`profile_id`, `category_id`, `transaction_year`, `transaction_month`, `amount`, `is_paid`, `note`, `updated_at`) VALUES
(1, 1, 2568, 1, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 2, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 3, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 4, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 5, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 6, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 7, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 8, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 9, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 10, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 11, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 1, 2568, 12, 0.00, 0, '', '2025-09-05 06:07:33'),
(1, 2, 2568, 1, 0.00, 0, '', '2025-09-05 05:57:01'),
(2, 10, 2568, 1, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 2, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 3, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 4, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 5, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 6, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 7, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 8, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 9, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 10, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 11, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 10, 2568, 12, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 1, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 2, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 3, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 4, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 5, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 6, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 7, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 8, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 9, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 10, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 11, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 11, 2568, 12, 0.00, 0, '', '2025-09-05 07:44:05'),
(2, 12, 2568, 3, 0.00, 0, '', '2025-09-05 07:43:56'),
(2, 12, 2568, 4, 0.00, 0, '', '2025-09-05 07:43:56'),
(2, 12, 2568, 7, 0.00, 0, '', '2025-09-05 06:48:36'),
(2, 12, 2568, 9, 0.00, 0, '', '2025-09-05 06:52:32'),
(2, 12, 2568, 10, 0.00, 0, '', '2025-09-05 06:52:32'),
(2, 12, 2568, 11, 0.00, 0, '', '2025-09-05 06:52:32'),
(2, 13, 2568, 2, 0.00, 0, '', '2025-09-05 07:43:56'),
(2, 13, 2568, 4, 0.00, 0, '', '2025-09-05 07:43:56'),
(2, 13, 2568, 9, 0.00, 0, '', '2025-09-05 06:52:32'),
(2, 13, 2568, 10, 0.00, 0, '', '2025-09-05 06:52:32'),
(2, 14, 2568, 2, 0.00, 0, '', '2025-09-05 07:43:56'),
(2, 14, 2568, 3, 0.00, 0, '', '2025-09-05 07:43:56'),
(2, 14, 2568, 9, 0.00, 0, '', '2025-09-05 07:43:56'),
(2, 14, 2568, 10, 0.00, 0, '', '2025-09-05 06:52:32'),
(2, 16, 2568, 1, 0.00, 0, '', '2025-09-05 07:43:56'),
(2, 16, 2568, 2, 0.00, 0, '', '2025-09-05 06:49:23'),
(2, 16, 2568, 5, 0.00, 0, '', '2025-09-05 07:43:56'),
(2, 16, 2568, 7, 0.00, 0, '', '2025-09-05 06:52:32'),
(2, 16, 2568, 9, 0.00, 0, '', '2025-09-05 07:43:56'),
(2, 16, 2568, 11, 0.00, 0, '', '2025-09-05 06:52:32'),
(2, 16, 2568, 12, 0.00, 0, '', '2025-09-05 06:52:32');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`category_id`),
  ADD KEY `profile_id` (`profile_id`),
  ADD KEY `goal_id` (`goal_id`);

--
-- Indexes for table `profiles`
--
ALTER TABLE `profiles`
  ADD PRIMARY KEY (`profile_id`),
  ADD UNIQUE KEY `profile_name` (`profile_name`);

--
-- Indexes for table `recurring_transactions`
--
ALTER TABLE `recurring_transactions`
  ADD PRIMARY KEY (`category_id`);

--
-- Indexes for table `savings_goals`
--
ALTER TABLE `savings_goals`
  ADD PRIMARY KEY (`goal_id`),
  ADD KEY `profile_id` (`profile_id`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`profile_id`,`category_id`,`transaction_year`,`transaction_month`),
  ADD KEY `category_id` (`category_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `profiles`
--
ALTER TABLE `profiles`
  MODIFY `profile_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `savings_goals`
--
ALTER TABLE `savings_goals`
  MODIFY `goal_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `categories`
--
ALTER TABLE `categories`
  ADD CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `categories_ibfk_2` FOREIGN KEY (`goal_id`) REFERENCES `savings_goals` (`goal_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `recurring_transactions`
--
ALTER TABLE `recurring_transactions`
  ADD CONSTRAINT `recurring_transactions_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `savings_goals`
--
ALTER TABLE `savings_goals`
  ADD CONSTRAINT `savings_goals_ibfk_1` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`profile_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `transactions`
--
ALTER TABLE `transactions`
  ADD CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
