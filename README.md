
### 1. The Diet Clerk Journey (Data Ingestion)
The Diet Clerk is the primary data entry point for the hospital's daily operations. Their workflow is focused entirely on the frontend UI and the `census_entries` table.

* **The Task:** Every morning, the Diet Clerk logs into the React frontend and inputs the patient headcount for each specific ward (e.g., Ward 01, Ward 02) broken down by diet type (Normal, Diabetic, High Protein, Liquid).
* **The Backend Process:** When they click "Submit," the frontend sends a `POST` request to the backend. The controller validates the numbers, ensures no duplicate entries exist for that ward on that specific date, and saves the raw data into the PostgreSQL `census_entries` table. 
* **The State:** The system status for that day remains "Pending" until all wards have submitted their counts.

### 2. The Kitchen Manager / Subject Clerk Journey (The Calculation)
Once the raw patient numbers are in the system, the administrative staff triggers the heavy lifting.

* **The Task:** They review the aggregated ward data and initiate the Daily Calculation.
* **The Backend Process:** This triggers the `calculationController` we discussed earlier. The Node.js engine pulls the active menu cycle (e.g., Chicken or Fish), fetches the `norm_weights` (e.g., 150g rice per person), applies medical diet overrides, and executes the math using the `uom.js` base units.
* **The Output:** The final matrix of ingredients is stored as a JSON payload inside the `calculation_runs` table, freezing the data in place so it cannot be accidentally altered if a late ward submits a change.

### 3. The Accountant Journey (Financial Approval)
The Accountant is isolated from the daily ward counts and recipes; they only care about the final procurement numbers and vendor costs.

* **The Task:** The Accountant views the output of the calculation engine, which the system automatically formats into a Draft Purchase Order (PO). 
* **The Backend Process:** The frontend pulls the finalized data and the current market prices for each ingredient (e.g., the cost of 1 Kg of Nadu Rice). The system calculates the total financial cost for the day's meals.
* **The Approval:** When the Accountant clicks "Approve," the backend updates the `purchase_orders` table status to "Approved" and logs the exact timestamp and the Accountant's user ID into the `audit_logs` table for strict financial compliance.

### 4. The System Administrator Journey (Configuration)
The Admin manages the rules that dictate how the rest of the system behaves.

* **The Task:** They manage user accounts, reset passwords, define the rotating menu cycles (Week 1, Week 2), and update the master ingredient lists.
* **The Backend Process:** Actions taken by the Admin usually hit configuration tables like `users`, `diet_cycles`, or `items`. Because Admin actions can drastically alter the entire hospital's workflow, every single POST, PUT, or DELETE request they make is heavily tracked by the `writeAudit()` function.

To keep utilizing the active recall methodology, which of these four specific user journeys would you like to tear down next?
