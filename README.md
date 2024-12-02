**Require Extension for VSCode**
- Solidity

**To install needed package for Windows**
  ```powershell
  .\setup.ps1
  ```

**To install needed package for Linux**
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
  ```
  ```bash
  bash setup.sh
  ```

## Steps to Run the Project

1. **Start Ganache Network**
   - Open Ganache (either the Ganache GUI or Ganache CLI).
   - Make sure that Ganache is running on the default settings (`127.0.0.1:7545`).
   - If using Ganache CLI, make sure it’s started with the following:
     ```bash
     ganache --port 8545 --networkId 5777
     ```

2. **Open Truffle Console**
   - Navigate to your project directory in the terminal:
     ```bash
     cd path/to/your/project
     ```
   - Compile and Migrate the contract to truffle
     ```bash
     truffle migrate --network development
     ```
   - Run the following command to open the Truffle console:
     ```bash
     truffle console --network development
     ```

3. **Update Network (Before Running Any Tests)**
   - Every time you enter the Truffle console, it is recommended to deploy or redeploy your contracts:
     ```bash
     truffle migrate --network development
     ```

4. **Run the Tests**
   - Once the contract is deployed and the migration is complete, you can run the tests to verify that everything is working correctly:
     ```bash
     truffle test
     ```
