# Hospital Meal Management System 🏥

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

A comprehensive, full-stack web application designed to digitize and automate the dietary calculation and meal management processes for hospital kitchens. This system replaces legacy, error-prone Excel-based workflows with a streamlined, centralized platform.

---

## 📖 Overview

In large healthcare facilities, accurately calculating meal requirements and raw ingredient volumes based on fluctuating daily patient censuses is a complex logistical challenge. 

This system aggregates daily patient dietary requirements and automates the underlying business logic for ingredient calculations. By utilizing a robust calculation engine, it ensures exact raw material purchasing, minimizes food waste, and significantly reduces the administrative burden on hospital staff.

## ✨ Key Features

* **Automated Ingredient Calculation:** Dynamically converts daily patient headcounts and specific dietary requirements into exact raw ingredient measurements.
* **Modern, Minimalist UI:** A clean, professional interface utilizing a minimalist green color palette and the highly legible *Inter* font, designed for fast data entry and low cognitive load for hospital staff.
* **Legacy System Modernization:** Fully replaces manual, decentralized Excel spreadsheets with a centralized database architecture.
* **RESTful API Architecture:** Seamless and secure data flow between the client and server.

## 🛠️ Tech Stack

**Frontend**
* React.js
* CSS (Custom minimalist UI with green theming and Inter font)

**Backend**
* Node.js
* Express.js

**Database**
* PostgreSQL (Relational data modeling for complex meal, patient, and ingredient relationships)

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v16 or higher)
* PostgreSQL installed and running locally
* Git

### 1. Database Setup
1. Create a new PostgreSQL database named `hospital_meals`.
2. Run the provided SQL schema file to generate the required tables.

### 2. Backend Setup
```bash
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Create a .env file and configure your database credentials
# Start the development server
npm run dev
