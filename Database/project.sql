-- phpMyAdmin SQL Dump
-- version 5.0.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Sep 12, 2026 at 11:09 AM
-- Server version: 5.7.31
-- PHP Version: 7.3.21

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `project`
--

-- --------------------------------------------------------

--
-- Table structure for table `categories_tab`
--

DROP TABLE IF EXISTS `categories_tab`;
CREATE TABLE IF NOT EXISTS `categories_tab` (
  `cat_id` int(11) NOT NULL AUTO_INCREMENT,
  `cat_name` varchar(100) NOT NULL,
  `description` text,
  `image` varchar(255) DEFAULT '',
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `create_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`cat_id`),
  UNIQUE KEY `cat_name` (`cat_name`)
) ENGINE=MyISAM AUTO_INCREMENT=14 DEFAULT CHARSET=latin1;

--
-- Dumping data for table `categories_tab`
--

INSERT INTO `categories_tab` (`cat_id`, `cat_name`, `description`, `image`, `status`, `create_at`) VALUES
(9, 'Cold Drinks', 'Cold drinks and beverages', 'cold-drinks.jpg', 'Active', '2026-05-22 15:06:21'),
(8, 'Dairy', 'Fresh dairy products', 'dairy.jpg', 'Active', '2026-04-22 15:06:21'),
(7, 'Vegetables', 'Fresh vegetables', 'vegetables.jpg', 'Active', '2026-03-23 15:06:21'),
(6, 'Fruits', 'Fresh and healthy fruits', 'fruits.jpg', 'Active', '2026-02-21 15:06:21'),
(10, 'Dry Fruits', 'Healthy dry fruits and nuts', 'dry-fruits.jpg', 'Active', '2026-06-21 15:06:21'),
(11, 'Snacks', 'Snacks and packaged food', 'snacks.jpg', 'Active', '2026-07-21 15:06:21');

-- --------------------------------------------------------

--
-- Table structure for table `customer_tab`
--

DROP TABLE IF EXISTS `customer_tab`;
CREATE TABLE IF NOT EXISTS `customer_tab` (
  `customer_id` int(3) NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT '',
  `address` text,
  `phone` varchar(10) NOT NULL,
  `city` varchar(100) DEFAULT '',
  `status` enum('Active','inactive') NOT NULL DEFAULT 'Active',
  `create_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date` date DEFAULT NULL,
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `phone` (`phone`)
) ENGINE=MyISAM AUTO_INCREMENT=57 DEFAULT CHARSET=latin1;

--
-- Dumping data for table `customer_tab`
--

INSERT INTO `customer_tab` (`customer_id`, `customer_name`, `email`, `address`, `phone`, `city`, `status`, `create_at`, `date`) VALUES
(1, 'Aarav Patel', 'aarav.patel@example.com', 'Rajkot', '9876543210', 'Rajkot', 'Active', '2026-02-21 15:08:37', '2026-02-21'),
(2, 'Diya Shah', 'diya.shah@example.com', 'Ahmedabad', '8765432109', 'Ahmedabad', 'Active', '2026-02-26 15:08:37', '2026-02-26'),
(3, 'Krish Mehta', 'krish.mehta@example.com', 'Surat', '7654321098', 'Surat', 'Active', '2026-03-03 15:08:37', '2026-03-03'),
(4, 'Anaya Desai', 'anaya.desai@example.com', 'Jamnagar', '9654321087', 'Jamnagar', 'Active', '2026-03-08 15:08:37', '2026-03-08'),
(5, 'Vivaan Joshi', 'vivaan.joshi@example.com', 'Porbandar', '8543210987', 'Porbandar', 'Active', '2026-03-13 15:08:37', '2026-03-13'),
(6, 'Kiara Parmar', 'kiara.parmar@example.com', 'Rajkot', '7432109876', 'Rajkot', 'Active', '2026-03-18 15:08:37', '2026-03-18'),
(7, 'Aditya Solanki', 'aditya.solanki@example.com', 'Ahmedabad', '9321098765', 'Ahmedabad', 'Active', '2026-03-23 15:08:37', '2026-03-23'),
(8, 'Riya Trivedi', 'riya.trivedi@example.com', 'Surat', '8210987654', 'Surat', 'Active', '2026-03-28 15:08:37', '2026-03-28'),
(9, 'Arjun Rathod', 'arjun.rathod@example.com', 'Jamnagar', '7109876543', 'Jamnagar', 'Active', '2026-04-02 15:08:37', '2026-04-02'),
(10, 'Ishita Pandya', 'ishita.pandya@example.com', 'Porbandar', '6987654321', 'Porbandar', 'Active', '2026-04-07 15:08:37', '2026-04-07'),
(11, 'Dhruv Patel', 'dhruv.patel@example.com', 'Rajkot', '9876123450', 'Rajkot', 'Active', '2026-04-12 15:08:37', '2026-04-12'),
(12, 'Mahi Shah', 'mahi.shah@example.com', 'Ahmedabad', '8765123409', 'Ahmedabad', 'Active', '2026-04-17 15:08:37', '2026-04-17'),
(13, 'Yash Mehta', 'yash.mehta@example.com', 'Surat', '7654123098', 'Surat', 'Active', '2026-04-22 15:08:37', '2026-04-22'),
(14, 'Avni Desai', 'avni.desai@example.com', 'Jamnagar', '9654123087', 'Jamnagar', 'Active', '2026-04-27 15:08:37', '2026-04-27'),
(15, 'Reyansh Joshi', 'reyansh.joshi@example.com', 'Porbandar', '8543123097', 'Porbandar', 'Active', '2026-05-02 15:08:37', '2026-05-02'),
(16, 'Myra Parmar', 'myra.parmar@example.com', 'Rajkot', '7432123086', 'Rajkot', 'Active', '2026-05-07 15:08:37', '2026-05-07'),
(17, 'Harsh Solanki', 'harsh.solanki@example.com', 'Ahmedabad', '9321123075', 'Ahmedabad', 'Active', '2026-05-12 15:08:37', '2026-05-12'),
(18, 'Nisha Trivedi', 'nisha.trivedi@example.com', 'Surat', '8210123064', 'Surat', 'Active', '2026-05-17 15:08:37', '2026-05-17'),
(19, 'Dev Rathod', 'dev.rathod@example.com', 'Jamnagar', '7109123053', 'Jamnagar', 'Active', '2026-05-22 15:08:37', '2026-05-22'),
(20, 'Pooja Pandya', 'pooja.pandya@example.com', 'Porbandar', '6987123042', 'Porbandar', 'Active', '2026-05-27 15:08:37', '2026-05-27'),
(21, 'Manav Patel', 'manav.patel@example.com', 'Rajkot', '9876012345', 'Rajkot', 'Active', '2026-06-01 15:08:37', '2026-06-01'),
(22, 'Isha Shah', 'isha.shah@example.com', 'Ahmedabad', '8765012346', 'Ahmedabad', 'Active', '2026-06-03 15:08:37', '2026-06-03'),
(23, 'Rudra Mehta', 'rudra.mehta@example.com', 'Surat', '7654012347', 'Surat', 'Active', '2026-06-05 15:08:37', '2026-06-05'),
(24, 'Aadhya Desai', 'aadhya.desai@example.com', 'Jamnagar', '9654012348', 'Jamnagar', 'Active', '2026-06-07 15:08:37', '2026-06-07'),
(25, 'Atharv Joshi', 'atharv.joshi@example.com', 'Porbandar', '8543012349', 'Porbandar', 'Active', '2026-06-09 15:08:37', '2026-06-09'),
(26, 'Navya Parmar', 'navya.parmar@example.com', 'Rajkot', '7432012350', 'Rajkot', 'Active', '2026-06-11 15:08:37', '2026-06-11'),
(27, 'Jay Solanki', 'jay.solanki@example.com', 'Ahmedabad', '9321012351', 'Ahmedabad', 'Active', '2026-06-13 15:08:37', '2026-06-13'),
(28, 'Kavya Trivedi', 'kavya.trivedi@example.com', 'Surat', '8210012352', 'Surat', 'Active', '2026-06-15 15:08:37', '2026-06-15'),
(29, 'Siddharth Rathod', 'siddharth.rathod@example.com', 'Jamnagar', '7109012353', 'Jamnagar', 'Active', '2026-06-17 15:08:37', '2026-06-17'),
(30, 'Meera Pandya', 'meera.pandya@example.com', 'Porbandar', '6987012354', 'Porbandar', 'Active', '2026-06-19 15:08:37', '2026-06-19'),
(31, 'Kunal Patel', 'kunal.patel@example.com', 'Rajkot', '9876012355', 'Rajkot', 'Active', '2026-06-21 15:08:37', '2026-06-21'),
(32, 'Tanvi Shah', 'tanvi.shah@example.com', 'Ahmedabad', '8765012356', 'Ahmedabad', 'Active', '2026-06-23 15:08:37', '2026-06-23'),
(33, 'Rohan Mehta', 'rohan.mehta@example.com', 'Surat', '7654012357', 'Surat', 'Active', '2026-06-25 15:08:37', '2026-06-25'),
(34, 'Sneha Desai', 'sneha.desai@example.com', 'Jamnagar', '9654012358', 'Jamnagar', 'Active', '2026-06-27 15:08:37', '2026-06-27'),
(35, 'Nirav Joshi', 'nirav.joshi@example.com', 'Porbandar', '8543012359', 'Porbandar', 'Active', '2026-06-29 15:08:37', '2026-06-29'),
(36, 'Jhanvi Parmar', 'jhanvi.parmar@example.com', 'Rajkot', '7432012360', 'Rajkot', 'Active', '2026-07-01 15:08:37', '2026-07-01'),
(37, 'Akash Solanki', 'akash.solanki@example.com', 'Ahmedabad', '9321012361', 'Ahmedabad', 'Active', '2026-07-06 15:08:37', '2026-07-06'),
(38, 'Neha Trivedi', 'neha.trivedi@example.com', 'Surat', '8210012362', 'Surat', 'Active', '2026-07-11 15:08:37', '2026-07-11'),
(39, 'Vivek Rathod', 'vivek.rathod@example.com', 'Jamnagar', '7109012363', 'Jamnagar', 'Active', '2026-07-16 15:08:37', '2026-07-16'),
(40, 'Hetal Pandya', 'hetal.pandya@example.com', 'Porbandar', '6987012364', 'Porbandar', 'Active', '2026-07-21 15:08:37', '2026-07-21'),
(41, 'Rahul Patel', 'rahul.patel@example.com', 'Rajkot', '9876012365', 'Rajkot', 'Active', '2026-07-23 15:08:37', '2026-07-23'),
(42, 'Simran Shah', 'simran.shah@example.com', 'Ahmedabad', '8765012366', 'Ahmedabad', 'Active', '2026-07-25 15:08:37', '2026-07-25'),
(43, 'Mohit Mehta', 'mohit.mehta@example.com', 'Surat', '7654012367', 'Surat', 'Active', '2026-07-27 15:08:37', '2026-07-27'),
(44, 'Komal Desai', 'komal.desai@example.com', 'Jamnagar', '9654012368', 'Jamnagar', 'Active', '2026-07-29 15:08:37', '2026-07-29'),
(45, 'Suresh Joshi', 'suresh.joshi@example.com', 'Porbandar', '8543012369', 'Porbandar', 'Active', '2026-07-31 15:08:37', '2026-07-31'),
(46, 'Payal Parmar', 'payal.parmar@example.com', 'Rajkot', '7432012370', 'Rajkot', 'Active', '2026-08-02 15:08:37', '2026-08-02'),
(47, 'Nitin Solanki', 'nitin.solanki@example.com', 'Ahmedabad', '9321012371', 'Ahmedabad', 'Active', '2026-08-04 15:08:37', '2026-08-04'),
(48, 'Bhavna Trivedi', 'bhavna.trivedi@example.com', 'Surat', '8210012372', 'Surat', 'Active', '2026-08-06 15:08:37', '2026-08-06'),
(49, 'Amit Rathod', 'amit.rathod@example.com', 'Jamnagar', '7109012373', 'Jamnagar', 'Active', '2026-08-08 15:08:37', '2026-08-08'),
(50, 'Rina Pandya', 'rina.pandya@example.com', 'Porbandar', '6987012374', 'Porbandar', 'Active', '2026-08-10 15:08:37', '2026-08-10'),
(53, 'ishita khunti', 'ishita@gmail.com', 'Street 34,', '6787890987', 'Ahemdabad', 'Active', '2026-08-25 13:38:56', '2026-08-25'),
(56, 'parmar shivam', 'shivam@gmail.com', 'rameshwar plot bhanvad', '6543213455', 'bhanvad', 'Active', '2026-09-02 07:11:04', '2026-09-02');

-- --------------------------------------------------------

--
-- Table structure for table `order_item`
--

DROP TABLE IF EXISTS `order_item`;
CREATE TABLE IF NOT EXISTS `order_item` (
  `item_id` int(3) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quntity` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  PRIMARY KEY (`item_id`),
  KEY `fk_order` (`order_id`),
  KEY `fk_product` (`product_id`)
) ENGINE=MyISAM AUTO_INCREMENT=110 DEFAULT CHARSET=latin1;

--
-- Dumping data for table `order_item`
--

INSERT INTO `order_item` (`item_id`, `order_id`, `product_id`, `quntity`, `price`, `subtotal`) VALUES
(1, 1, 1, 5, '40.00', '200.00'),
(2, 2, 2, 3, '120.00', '360.00'),
(3, 3, 3, 2, '100.00', '200.00'),
(4, 4, 4, 5, '80.00', '400.00'),
(5, 5, 5, 3, '90.00', '270.00'),
(6, 6, 6, 4, '35.00', '140.00'),
(7, 7, 7, 3, '45.00', '135.00'),
(8, 8, 8, 6, '50.00', '300.00'),
(9, 9, 9, 4, '60.00', '240.00'),
(10, 10, 10, 5, '40.00', '200.00'),
(11, 11, 11, 3, '60.00', '180.00'),
(12, 12, 12, 5, '50.00', '250.00'),
(13, 13, 13, 4, '55.00', '220.00'),
(14, 14, 14, 2, '150.00', '300.00'),
(15, 15, 15, 6, '45.00', '270.00'),
(16, 16, 16, 4, '45.00', '180.00'),
(17, 17, 17, 5, '40.00', '200.00'),
(29, 18, 18, 3, '40.00', '120.00'),
(19, 19, 19, 2, '300.00', '600.00'),
(20, 20, 20, 2, '350.00', '700.00'),
(21, 21, 21, 3, '200.00', '600.00'),
(22, 22, 22, 5, '30.00', '150.00'),
(23, 23, 23, 4, '40.00', '160.00'),
(31, 28, 22, 1, '30.00', '30.00'),
(106, 26, 13, 1, '55.00', '55.00'),
(32, 28, 15, 1, '45.00', '45.00'),
(33, 28, 5, 1, '90.00', '90.00'),
(34, 29, 26, 1, '50.00', '50.00'),
(35, 29, 16, 1, '45.00', '45.00'),
(36, 29, 17, 1, '40.00', '40.00'),
(37, 29, 22, 1, '30.00', '30.00'),
(38, 30, 3, 1, '100.00', '100.00'),
(39, 30, 11, 1, '60.00', '60.00'),
(40, 30, 12, 1, '50.00', '50.00'),
(41, 30, 26, 1, '50.00', '50.00'),
(42, 30, 23, 1, '40.00', '40.00'),
(43, 31, 22, 1, '30.00', '30.00'),
(44, 31, 15, 1, '45.00', '45.00'),
(45, 31, 26, 1, '50.00', '50.00'),
(46, 32, 1, 1, '40.00', '40.00'),
(47, 32, 2, 1, '120.00', '120.00'),
(48, 32, 4, 1, '80.00', '80.00'),
(49, 32, 5, 1, '90.00', '90.00'),
(50, 32, 19, 1, '300.00', '300.00'),
(51, 33, 1, 1, '40.00', '40.00'),
(52, 33, 2, 1, '120.00', '120.00'),
(53, 34, 9, 1, '60.00', '60.00'),
(54, 34, 10, 1, '40.00', '40.00'),
(62, 38, 2, 1, '120.00', '120.00'),
(61, 37, 11, 1, '30.00', '30.00'),
(60, 37, 1, 1, '40.00', '40.00'),
(63, 39, 20, 1, '350.00', '350.00'),
(64, 39, 12, 1, '50.00', '50.00'),
(65, 40, 4, 1, '80.00', '80.00'),
(66, 40, 6, 1, '35.00', '35.00'),
(67, 41, 7, 1, '45.00', '45.00'),
(68, 41, 8, 1, '50.00', '50.00'),
(69, 41, 9, 1, '60.00', '60.00'),
(70, 41, 11, 1, '60.00', '60.00'),
(71, 41, 10, 1, '40.00', '40.00'),
(72, 41, 12, 1, '50.00', '50.00'),
(73, 41, 14, 1, '150.00', '150.00'),
(74, 41, 20, 1, '350.00', '350.00'),
(75, 41, 21, 1, '200.00', '200.00'),
(76, 41, 19, 1, '300.00', '300.00'),
(77, 41, 26, 1, '50.00', '50.00'),
(78, 41, 17, 1, '40.00', '40.00'),
(79, 42, 20, 1, '350.00', '350.00'),
(80, 42, 1, 1, '40.00', '40.00'),
(81, 43, 20, 1, '350.00', '350.00'),
(82, 43, 19, 1, '300.00', '300.00'),
(83, 43, 11, 1, '60.00', '60.00'),
(84, 43, 24, 1, '60.00', '60.00'),
(85, 43, 16, 1, '45.00', '45.00'),
(86, 43, 26, 1, '50.00', '50.00'),
(87, 44, 26, 1, '50.00', '50.00'),
(88, 44, 17, 1, '40.00', '40.00'),
(89, 44, 24, 1, '60.00', '60.00'),
(90, 45, 8, 1, '50.00', '50.00'),
(91, 45, 9, 1, '60.00', '60.00'),
(92, 45, 10, 1, '40.00', '40.00'),
(93, 45, 7, 1, '45.00', '45.00'),
(94, 45, 4, 1, '80.00', '80.00'),
(95, 45, 2, 1, '120.00', '120.00'),
(96, 46, 5, 1, '90.00', '90.00'),
(97, 46, 11, 1, '60.00', '60.00'),
(98, 46, 13, 1, '55.00', '55.00'),
(99, 46, 19, 1, '300.00', '300.00'),
(100, 46, 20, 1, '350.00', '350.00'),
(101, 47, 26, 6, '50.00', '300.00'),
(102, 48, 2, 1, '120.00', '120.00'),
(103, 48, 1, 1, '40.00', '40.00'),
(104, 48, 4, 1, '80.00', '80.00'),
(105, 49, 26, 1, '50.00', '50.00'),
(107, 50, 26, 1, '50.00', '50.00'),
(108, 51, 26, 1, '50.00', '50.00'),
(109, 51, 19, 1, '300.00', '300.00');

-- --------------------------------------------------------

--
-- Table structure for table `order_tab`
--

DROP TABLE IF EXISTS `order_tab`;
CREATE TABLE IF NOT EXISTS `order_tab` (
  `order_id` int(3) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` enum('Cash','UPI','Card') NOT NULL,
  `payment_status` enum('Pending','Paid','Partial Paid') NOT NULL,
  `order_status` enum('Pending','Processing','Completed','Cancelled') NOT NULL,
  `order_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `cash_received` decimal(10,2) DEFAULT NULL,
  `change_returned` decimal(10,2) DEFAULT NULL,
  `cashier_name` varchar(150) DEFAULT NULL,
  `cashier_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`order_id`),
  KEY `customer_id` (`customer_id`)
) ENGINE=MyISAM AUTO_INCREMENT=52 DEFAULT CHARSET=latin1;

--
-- Dumping data for table `order_tab`
--

INSERT INTO `order_tab` (`order_id`, `customer_id`, `total_amount`, `payment_method`, `payment_status`, `order_status`, `order_date`, `cash_received`, `change_returned`, `cashier_name`, `cashier_id`) VALUES
(1, 1, '200.00', 'Cash', 'Paid', 'Completed', '2026-02-21 15:15:48', NULL, NULL, 'shivam parmar', 56),
(2, 2, '350.00', 'Cash', 'Paid', 'Completed', '2026-03-03 15:15:48', NULL, NULL, 'shivam parmar', 56),
(3, 3, '180.00', 'Cash', 'Paid', 'Completed', '2026-03-13 15:15:48', NULL, NULL, 'shivam parmar', 56),
(4, 4, '500.00', 'Cash', 'Paid', 'Completed', '2026-03-23 15:15:48', NULL, NULL, 'shivam parmar', 56),
(5, 5, '275.00', 'Cash', 'Paid', 'Completed', '2026-04-02 15:15:48', NULL, NULL, 'shivam parmar', 56),
(6, 6, '420.00', 'Cash', 'Paid', 'Completed', '2026-04-12 15:15:48', NULL, NULL, 'shivam parmar', 56),
(7, 7, '150.00', 'Cash', 'Paid', 'Completed', '2026-04-22 15:15:48', NULL, NULL, 'shivam parmar', 56),
(8, 8, '600.00', 'Cash', 'Paid', 'Completed', '2026-05-02 15:15:48', NULL, NULL, 'shivam parmar', 56),
(9, 9, '325.00', 'Cash', 'Paid', 'Completed', '2026-05-12 15:15:48', NULL, NULL, 'shivam parmar', 56),
(10, 10, '450.00', 'Cash', 'Paid', 'Completed', '2026-05-22 15:15:48', NULL, NULL, 'shivam parmar', 56),
(11, 11, '225.00', 'Cash', 'Paid', 'Completed', '2026-06-01 15:15:48', NULL, NULL, 'shivam parmar', 56),
(12, 12, '700.00', 'Cash', 'Paid', 'Completed', '2026-06-06 15:15:48', NULL, NULL, 'shivam parmar', 56),
(13, 13, '375.00', 'Cash', 'Paid', 'Completed', '2026-06-11 15:15:48', NULL, NULL, 'shivam parmar', 56),
(14, 14, '280.00', 'Cash', 'Paid', 'Completed', '2026-06-16 15:15:48', NULL, NULL, 'shivam parmar', 56),
(15, 15, '550.00', 'Cash', 'Paid', 'Completed', '2026-06-21 15:15:48', NULL, NULL, 'shivam parmar', 56),
(16, 16, '190.00', 'Cash', 'Paid', 'Completed', '2026-06-26 15:15:48', NULL, NULL, 'shivam parmar', 56),
(17, 17, '480.00', 'Cash', 'Paid', 'Completed', '2026-07-01 15:15:48', NULL, NULL, 'shivam parmar', 56),
(18, 18, '120.00', 'Cash', 'Paid', 'Completed', '2026-07-06 15:15:48', NULL, NULL, 'shivam parmar', 56),
(19, 19, '650.00', 'Cash', 'Paid', 'Completed', '2026-07-11 15:15:48', NULL, NULL, 'shivam parmar', 56),
(20, 20, '240.00', 'Cash', 'Paid', 'Completed', '2026-07-16 15:15:48', NULL, NULL, 'shivam parmar', 56),
(21, 21, '390.00', 'Cash', 'Paid', 'Completed', '2026-07-21 15:15:48', NULL, NULL, 'shivam parmar', 56),
(22, 22, '520.00', 'Cash', 'Paid', 'Completed', '2026-07-26 15:15:48', NULL, NULL, 'shivam parmar', 56),
(23, 23, '160.00', 'Cash', 'Paid', 'Completed', '2026-07-31 15:15:48', NULL, NULL, 'shivam parmar', 56),
(26, 1, '55.00', 'Cash', 'Paid', 'Completed', '2026-08-25 06:40:20', NULL, NULL, 'shivam parmar', 56),
(28, 24, '165.00', 'Cash', 'Paid', 'Completed', '2026-09-02 06:09:03', NULL, NULL, 'shivam parmar', 56),
(29, 24, '165.00', 'Cash', 'Paid', 'Completed', '2026-09-02 06:23:50', NULL, NULL, 'shivam parmar', 56),
(30, 56, '300.00', 'Cash', 'Paid', 'Completed', '2026-09-02 07:18:10', NULL, NULL, 'shivam parmar', 56),
(31, 47, '125.00', 'Cash', 'Paid', 'Completed', '2026-09-02 13:51:06', NULL, NULL, 'shivam parmar', 56),
(32, 45, '630.00', 'Cash', 'Paid', 'Completed', '2026-09-03 10:48:25', NULL, NULL, 'shivam parmar', 56),
(33, 48, '160.00', 'Cash', 'Paid', 'Completed', '2026-09-03 10:49:48', NULL, NULL, 'shivam parmar', 56),
(34, 39, '100.00', 'Cash', 'Paid', 'Completed', '2026-09-05 11:04:50', NULL, NULL, 'shivam parmar', 56),
(37, 1, '70.00', 'Cash', 'Paid', 'Completed', '2026-09-05 11:32:20', '100.00', '30.00', 'shivam parmar', 56),
(38, 2, '120.00', 'Cash', 'Paid', 'Completed', '2026-09-05 11:34:07', '150.00', '30.00', 'shivam parmar', 56),
(39, 35, '400.00', 'Cash', 'Paid', 'Completed', '2026-09-05 11:35:34', '500.00', '100.00', 'shivam parmar', 56),
(40, 40, '115.00', 'Cash', 'Paid', 'Completed', '2026-09-05 12:23:02', '200.00', '85.00', 'mahek parmar', 55),
(41, 36, '1395.00', 'Cash', 'Paid', 'Completed', '2026-09-05 13:53:41', '1400.00', '5.00', 'mahek parmar', 55),
(42, 47, '390.00', 'Cash', 'Paid', 'Completed', '2026-09-08 05:02:07', '400.00', '10.00', 'shivam parmar', 56),
(43, 2, '865.00', 'Cash', 'Paid', 'Completed', '2026-09-09 07:49:13', '870.00', '5.00', 'shivam parmar', 56),
(44, 56, '150.00', 'Cash', 'Paid', 'Completed', '2026-09-09 07:57:19', '150.00', '0.00', 'shivam parmar', 56),
(45, 53, '395.00', 'Cash', 'Paid', 'Completed', '2026-09-09 08:03:45', '400.00', '5.00', 'shivam parmar', 56),
(46, 50, '855.00', 'Cash', 'Paid', 'Completed', '2026-09-09 12:42:58', '900.00', '45.00', 'shivam parmar', 56),
(47, 49, '300.00', 'Cash', 'Paid', 'Completed', '2026-09-09 12:47:08', '300.00', '0.00', 'shivam parmar', 56),
(48, 46, '240.00', 'Cash', 'Paid', 'Completed', '2026-09-09 12:55:03', '250.00', '10.00', 'shivam parmar', 56),
(49, 37, '50.00', 'Cash', 'Paid', 'Completed', '2026-09-09 12:57:43', '50.00', '0.00', 'shivam parmar', 56),
(50, 45, '50.00', 'Cash', 'Paid', 'Completed', '2026-09-10 04:37:50', '50.00', '0.00', 'mahek parmar', 55),
(51, 47, '350.00', 'Cash', 'Paid', 'Completed', '2026-09-10 05:00:13', '350.00', '0.00', 'mahek parmar', 55);

-- --------------------------------------------------------

--
-- Table structure for table `products_tab`
--

DROP TABLE IF EXISTS `products_tab`;
CREATE TABLE IF NOT EXISTS `products_tab` (
  `product_id` int(3) NOT NULL AUTO_INCREMENT,
  `cat_id` int(11) DEFAULT NULL,
  `product_name` varchar(150) DEFAULT NULL,
  `image` varchar(255) DEFAULT 'product-default.jpg',
  `price` decimal(10,2) NOT NULL,
  `stock` int(11) NOT NULL,
  `status` enum('in stock','low stock','Out of stock') NOT NULL DEFAULT 'in stock',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_id`),
  KEY `fk_category` (`cat_id`)
) ENGINE=MyISAM AUTO_INCREMENT=28 DEFAULT CHARSET=latin1;

--
-- Dumping data for table `products_tab`
--

INSERT INTO `products_tab` (`product_id`, `cat_id`, `product_name`, `image`, `price`, `stock`, `status`, `created_at`) VALUES
(1, 6, 'Banana', 'banana.jpg', '40.00', 94, 'in stock', '2026-02-21 15:15:03'),
(2, 6, 'Apple', 'apple.jpg', '120.00', 74, 'in stock', '2026-03-03 15:15:03'),
(3, 6, 'Mango', 'mango.jpg', '100.00', 69, 'in stock', '2026-03-13 15:15:03'),
(4, 6, 'Orange', 'orange.jpg', '80.00', 86, 'in stock', '2026-03-23 15:15:03'),
(5, 6, 'Pineapple', 'pineapple.jpg', '90.00', 57, 'in stock', '2026-04-02 15:15:03'),
(6, 7, 'Potato', 'potato.jpg', '35.00', 149, 'in stock', '2026-04-12 15:15:03'),
(7, 7, 'Onion', 'onion.jpg', '45.00', 128, 'in stock', '2026-04-22 15:15:03'),
(8, 7, 'Tomato', 'tomato.jpg', '50.00', 98, 'in stock', '2026-05-02 15:15:03'),
(9, 7, 'Carrot', 'carrot.jpg', '60.00', 77, 'in stock', '2026-05-12 15:15:03'),
(10, 7, 'Cabbage', 'cabbage.jpg', '40.00', 67, 'in stock', '2026-05-22 15:15:03'),
(11, 8, 'Milk', 'milk.jpg', '60.00', 95, 'in stock', '2026-06-01 15:15:03'),
(12, 8, 'Curd', 'curd.jpg', '50.00', 77, 'in stock', '2026-06-06 15:15:03'),
(13, 8, 'Butter', 'butter.jpg', '55.00', 59, 'in stock', '2026-06-11 15:15:03'),
(14, 8, 'Cheese', 'cheese.jpg', '150.00', 49, 'in stock', '2026-06-16 15:15:03'),
(15, 9, 'Coca Cola', 'coca-cola.jpg', '45.00', 88, 'in stock', '2026-06-21 15:15:03'),
(16, 9, 'Pepsi', 'pepsi.jpg', '45.00', 83, 'in stock', '2026-06-26 15:15:03'),
(17, 9, 'Sprite', 'sprite.jpg', '40.00', 72, 'in stock', '2026-07-01 15:15:03'),
(18, 9, 'Fanta', 'fanta.jpg', '40.00', 0, 'low stock', '2026-07-06 15:15:03'),
(19, 10, 'Almond', 'almond.jpg', '300.00', 34, 'in stock', '2026-07-11 15:15:03'),
(20, 10, 'Cashew', 'cashew.jpg', '350.00', 30, 'in stock', '2026-07-16 15:15:03'),
(21, 10, 'Raisins', 'raisins.jpg', '200.00', 44, 'in stock', '2026-07-21 15:15:03'),
(22, 11, 'Chips', 'chips.jpg', '30.00', 97, 'in stock', '2026-07-26 15:15:03'),
(23, 11, 'Biscuits', 'biscuits.jpg', '40.00', 88, 'in stock', '2026-07-31 15:15:03'),
(24, 11, 'Namkeen', 'namkeen.jpg', '60.00', 67, 'in stock', '2026-08-05 15:15:03'),
(26, 11, 'popcorn', 'product-default.jpg', '50.00', 5, 'low stock', '2026-08-25 06:02:39');

-- --------------------------------------------------------

--
-- Table structure for table `registration`
--

DROP TABLE IF EXISTS `registration`;
CREATE TABLE IF NOT EXISTS `registration` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(50) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `mobail` varchar(10) NOT NULL,
  `email` varchar(100) NOT NULL,
  `address` text,
  `role` varchar(30) NOT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `create_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `profile_picture` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `full_name` (`full_name`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `mobail` (`mobail`),
  UNIQUE KEY `email` (`email`)
) ENGINE=MyISAM AUTO_INCREMENT=57 DEFAULT CHARSET=latin1;

--
-- Dumping data for table `registration`
--

INSERT INTO `registration` (`id`, `full_name`, `username`, `password`, `mobail`, `email`, `address`, `role`, `status`, `create_at`, `profile_picture`) VALUES
(46, 'Durga parmar', 'durga_parmar123', '$2b$12$Kc3XBdZbS.xFlxUvqWfqsurHN/JXX290scJWt6tcrSARCTaEp5kmW', '9098987676', 'durgaparmar@gmail.com', 'Surat, Gujarat', 'Admin', 'Active', '2026-07-31 04:59:18', ''),
(56, 'shivam parmar', 'shivam_216', '$2b$12$8yA8ys2fgaPrdguAvkRYbuLZ1L1YSVtMilfTaMy88KgVavavbrFv6', '7896543454', 'shivam@gmail.com', '', 'Cashier', 'Active', '2026-09-04 06:40:57', NULL),
(55, 'mahek parmar', 'mahek_123', '$2b$12$rIExvMQSd5/BZyvoPgFy5u.ofqJrgWQkGYM4MnOjavUgcePWwEcNi', '6545342313', 'mahek@gmail.com', '', 'Cashier', 'Active', '2026-09-02 07:47:39', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `review`
--

DROP TABLE IF EXISTS `review`;
CREATE TABLE IF NOT EXISTS `review` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `subject` varchar(200) NOT NULL,
  `message` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=latin1;

--
-- Dumping data for table `review`
--

INSERT INTO `review` (`id`, `name`, `email`, `subject`, `message`) VALUES
(1, 'Test User', 'test@example.com', 'Service Feedback', 'Great grocery store management system!'),
(2, 'Jane Doe', 'jane@example.com', 'Inquiry', 'Checking stock availability.'),
(3, 'ram sharma', 'raj@gmail.com', 'feedback', 'Nice system management');

-- --------------------------------------------------------

--
-- Table structure for table `settings_tab`
--

DROP TABLE IF EXISTS `settings_tab`;
CREATE TABLE IF NOT EXISTS `settings_tab` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(50) NOT NULL,
  `setting_value` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=MyISAM AUTO_INCREMENT=15 DEFAULT CHARSET=latin1;

--
-- Dumping data for table `settings_tab`
--

INSERT INTO `settings_tab` (`id`, `setting_key`, `setting_value`) VALUES
(1, 'store_name', 'GroceryHub'),
(2, 'store_address', '68,MG ROAD, RAJKOT, GUJRAT'),
(3, 'store_phone', '9876543212'),
(4, 'store_email', 'groceryhub@example.com'),
(5, 'store_gst', 'GST12345'),
(6, 'invoice_prefix', 'INV-001'),
(7, 'invoice_gst', '5'),
(8, 'gst_number', '24ABCDEF1234F1Z5'),
(9, 'tax_percentage', '4.0'),
(10, 'theme', 'light'),
(11, 'invoice_currency', 'INR'),
(12, 'currency', 'INR'),
(13, 'date_format', 'DD/MM/YYYY'),
(14, 'notifications', 'true');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
