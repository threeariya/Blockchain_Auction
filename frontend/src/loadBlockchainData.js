import Web3 from "web3";
import EnglishAuction from "./contracts/EnglishAuction.json";
import SecondPriceAuction from "./contracts/SecondPriceAuction.json";

const loadBlockchainData = async () => {
  if (typeof window.ethereum === "undefined") {
    alert("MetaMask is not installed. Please install MetaMask to use this DApp.");
    return null;
  }

  const web3 = new Web3(window.ethereum);
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const accounts = await web3.eth.getAccounts();
  const networkId = await web3.eth.net.getId();

  const deployedEnglishAuction = EnglishAuction.networks[networkId];
  const deployedSecondPriceAuction = SecondPriceAuction.networks[networkId];

  if (!deployedEnglishAuction || !deployedSecondPriceAuction) {
    alert("Contracts not deployed on this network.");
    return null;
  }

  const englishAuctionContract = new web3.eth.Contract(
    EnglishAuction.abi,
    deployedEnglishAuction.address
  );

  const secondPriceAuctionContract = new web3.eth.Contract(
    SecondPriceAuction.abi,
    deployedSecondPriceAuction.address
  );

  return { web3, accounts, englishAuctionContract, secondPriceAuctionContract };
};

export default loadBlockchainData;
