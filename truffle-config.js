module.exports = {
  /**
   * Networks define how you connect to your Ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one, Truffle
   * will spin up a managed Ganache instance for you on port 9545 when you
   * run `develop` or `test`. You can ask a Truffle command to use a specific
   * network from the command line, e.g:
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Local development network for Ganache
    development: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 8545, // Standard Ganache port
      network_id: "1337", // Match Ganache network ID
      gas: 10000000, // Maximum gas for transactions (optional)
      gasPrice: 20000000000, // Gas price in wei (20 gwei, optional)
    },

    // Uncomment and configure the following networks if deploying to public or test networks
    // Goerli Testnet example:
    // goerli: {
    //   provider: () => new HDWalletProvider(MNEMONIC, `https://goerli.infura.io/v3/${PROJECT_ID}`),
    //   network_id: 5, // Goerli's id
    //   confirmations: 2, // # of confirmations to wait between deployments (default: 0)
    //   timeoutBlocks: 200, // # of blocks before a deployment times out (default: 50)
    //   skipDryRun: true, // Skip dry run before migrations (default: false for public nets)
    // },

    // Add private network configuration here
    // private: {
    //   provider: () => new HDWalletProvider(MNEMONIC, `https://your-private-network-url`),
    //   network_id: 2111, // Your private network's ID
    //   production: true, // Treats this network as if it was a public net (default: false)
    // },
  },

  // Set default mocha options here, use special reporters, etc.
  mocha: {
    timeout: 100000, // Specify a timeout for your tests if needed
  },

  // Configure your Solidity compiler
  compilers: {
    solc: {
      version: "0.8.21", // Use specific Solidity compiler version
      settings: {
        optimizer: {
          enabled: true, // Enable optimization for gas efficiency
          runs: 200, // Number of optimization runs
        },
        evmVersion: "istanbul", // Specify EVM version (default: "istanbul")
      },
    },
  },

  // Enable Truffle DB if needed (disabled by default)
  db: {
    enabled: false, // Enable to use Truffle DB (currently experimental)
  },
};
