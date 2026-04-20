├── backend/
│   ├── config/         # Database connection setup
│   ├── controllers/    # Core business logic (calculation, auth, daily cycle)
│   ├── models/         # PostgreSQL queries and data access layer
│   ├── routes/         # Express API endpoint definitions
│   └── utils/          # Helper functions (UOM normalization, Audit logging)
├── frontend/
│   ├── src/
│   │   ├── components/ # Reusable UI elements (Buttons, Dialogs, Badges)
│   │   ├── hooks/      # Custom React hooks (e.g., useToast)
│   │   ├── lib/        # Frontend utilities (Date formatting)
│   │   └── pages/      # Main views (AdminDailyCycle, SystemUsers, Orders)
└── database/
    └── schema.sql      # Full PostgreSQL DDL script
