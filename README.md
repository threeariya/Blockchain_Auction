**Required Extension for VSCode**
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


## Steps to run the project

1. **Start Ganache Network**
    - Open Ganache (either the Ganache GUI or Ganache CLI).
    - Make sure that Ganache is running on the default settings (`127.0.0.1:8545`).
    - If using Ganache CLI in terminal, start a terminal in this repo root folder.
    - Type in the following:
      ```bash
      ganache --port 8545 --networkId 1337 --quiet
      ```

2. **Update Network (Before Running Any Tests)**
    - Start another terminal in this repo root folder:
    - Every time you enter the Truffle console, it is recommended to deploy or redeploy your contracts:
      ```bash
      truffle migrate --network development
      ```

3. **Open Truffle Console**
    - From the same terminal, run the following command to open the Truffle console:
      ```bash
      truffle console --network development
      ```

4. **Run the Tests**
    - Once the contract is deployed and the migration is complete, you can run the tests to verify that everything is working correctly:
      ```bash
      truffle test 
      ```

5. **Before running frontend app**
    - Install MetaMask browser extension
      https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn
    - Click on MetaMask extension icon or go to
      chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#onboarding/welcome

    - Click on "Create a new wallet"
    - Click on "No thanks"
    - Create a password and click on "Create a new wallet"
    - Click on "Remind me later"
    - On the top of the page, click on "Account 1"
    - Click on "Add account or hardware wallet"
    - Click on "Import account"
    - From the Ganache terminal, copy one of the private keys.
    - Enter the private key in the textbox and click "Import"

    - On the top left of the page, click on "Ethereum Mainnet"
    - Click on "Add a custom network"
    - For Network name, type anything
    - For Default RPC URL, type in "http://127.0.0.1:8545/" and click on "Add URL"
    - For Chain ID, type in "1337"
    - For Currency symbol, type in "ETH"
    - For Block explorer URL, leave it blank.
    - Again, on the top left of the page, click on "Ethereum Mainnet"
    - Scroll down and activate "Show test networks"
    - Make sure the network you created is there.

6. **Open the frontend app**
    - Start yet another terminal in this repo root folder
    - Navigate to frontend folder
      ```bash
      cd frontend
      ```
    - Install required dependencies:
      ```bash
      npm start
      ```
    - Start React app:
      ```bash
      npm start
      ```
    - The frontend web page will pop up. If not, manually go to "http://localhost:3000/english-auction"
    - A prompt from MetaMask will pop up.
    - Make sure for "See your accounts and suggest transactions", the account you just created is selected.
    - Make sure for "Use your enabled networks", only the network you created is selected. If not, press "Edit" to edit.
    - Click on "Connect"
    - Refresh the web page.