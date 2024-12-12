import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import loadBlockchainData from "./loadBlockchainData";
import EnglishAuctionPage from "./englishAuctionPage";
import SecondPriceAuctionPage from "./secondPriceAuctionPage";

const App = () => {
  const [blockchainData, setBlockchainData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const data = await loadBlockchainData();
      setBlockchainData(data);
    };
    fetchData();
  }, []);

  if (!blockchainData) {
    return <div>Loading blockchain data...</div>;
  }

  return (
    <Router>
      <div>
        <h1>Auction DApp</h1>
        <nav>
          <Link to="/english-auction">English Auction</Link> |{" "}
          <Link to="/second-price-auction">Second Price Auction</Link>
        </nav>
        <Routes>
          <Route
            path="/english-auction"
            element={<EnglishAuctionPage blockchainData={blockchainData} />}
          />
          <Route
            path="/second-price-auction"
            element={<SecondPriceAuctionPage blockchainData={blockchainData} />}
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
