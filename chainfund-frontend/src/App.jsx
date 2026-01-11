// src/App.jsx
import { useState } from "react";
import { ethers } from "ethers";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  FACTORY_ABI_FULL,
  FACTORY_BYTECODE,
  CAMPAIGN_ABI,
  CFD_ADDRESS,
  CFD_ABI
} from "./contracts";


function App() {
  const [account, setAccount] = useState(null);
  const [factory, setFactory] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [cfdBalance, setCfdBalance] = useState(null);
  const [ethBalance, setEthBalance] = useState(null);
  const [network, setNetwork] = useState(null);
  const [adminAddress, setAdminAddress] = useState(null);
  const [globalRole, setGlobalRole] = useState("guest"); // "admin" | "guest"


  const [contributeAmount, setContributeAmount] = useState("0.01");
  const [newGoal, setNewGoal] = useState("1"); // ETH
  const [newDuration, setNewDuration] = useState("3600"); // seconds


  const [newMinter, setNewMinter] = useState("");
  const [lastFactoryAddress, setLastFactoryAddress] = useState(null);
  const [currentFactoryAddress, setCurrentFactoryAddress] = useState(
    FACTORY_ADDRESS
  );


  // Demande l'accès au wallet MetaMask, charge les infos de base et initialise les contrats / états.
  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not detected");
      return;
    }


    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();
    const net = await provider.getNetwork();


    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      FACTORY_ABI,
      signer
    );


    setAccount(addr);
    setFactory(factoryContract);
    setNetwork(net);
    setCurrentFactoryAddress(FACTORY_ADDRESS);


    // Récupère le solde ETH de l'adresse connectée
    const balWei = await provider.getBalance(addr);
    setEthBalance(ethers.formatEther(balWei));


    // Détecte l'admin via factory.admin()
    const admin = await factoryContract.admin();
    setAdminAddress(admin);
    setGlobalRole(
      admin.toLowerCase() === addr.toLowerCase() ? "admin" : "guest"
    );


    // Récupère le solde de CFD de l'adresse connectée
    const cfd = new ethers.Contract(CFD_ADDRESS, CFD_ABI, provider);
    const bal = await cfd.balanceOf(addr);
    setCfdBalance(ethers.formatEther(bal));


    // Charge la liste initiale des campagnes
    await loadCampaigns(factoryContract, provider);
  }


  // Récupère les campagnes depuis la factory et construit une liste JS pour l'affichage.
  async function loadCampaigns(factoryContract, provider) {
    if (!factoryContract) return;


    try {
      const count = await factoryContract.getCampaignsCount();
      const items = [];


      for (let i = 0n; i < count; i++) {
        const [campaignAddress, owner, goal, deadline, exists] =
          await factoryContract.getCampaign(i);


        if (!exists) continue;


        const campaign = new ethers.Contract(
          campaignAddress,
          CAMPAIGN_ABI,
          provider
        );


        const total = await campaign.totalContributed();
        const state = await campaign.state();


        items.push({
          id: i,
          address: campaignAddress,
          owner,
          goal: ethers.formatEther(goal),
          totalContributed: ethers.formatEther(total),
          deadline: Number(deadline),
          state: Number(state)
        });
      }


      setCampaigns(items);
    } catch (e) {
      console.error("loadCampaigns error:", e);
      setCampaigns([]);
    }
  }


  // Détermine le rôle de l'utilisateur pour une campagne (owner / donor / guest).
  function getRoleForCampaign(campaign, account) {
    if (!account) return "guest";
    if (campaign.owner.toLowerCase() === account.toLowerCase()) {
      return "owner";
    }
    return "donor";
  }


  // Envoie des ETH à une campagne puis met à jour soldes et état des campagnes.
  async function handleContribute(campaignAddress) {
    if (!window.ethereum || !account) {
      alert("Connect your wallet first");
      return;
    }


    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();


    const campaign = new ethers.Contract(
      campaignAddress,
      CAMPAIGN_ABI,
      signer
    );


    const tx = await campaign.contribute({
      value: ethers.parseEther(contributeAmount)
    });
    await tx.wait();


    await loadCampaigns(factory, provider);


    const balWei = await provider.getBalance(account);
    setEthBalance(ethers.formatEther(balWei));
    const cfd = new ethers.Contract(CFD_ADDRESS, CFD_ABI, provider);
    const bal = await cfd.balanceOf(account);
    setCfdBalance(ethers.formatEther(bal));
  }


  // Retire les fonds d'une campagne réussie et déclenche la distribution des CFD.
  async function handleWithdraw(campaignId) {
    if (!factory || !account) {
      alert("Connect your wallet first");
      return;
    }


    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const tx = await factory.withdrawCampaign(campaignId);
      await tx.wait();


      await loadCampaigns(factory, provider);


      const balWei = await provider.getBalance(account);
      setEthBalance(ethers.formatEther(balWei));
      const cfd = new ethers.Contract(CFD_ADDRESS, CFD_ABI, provider);
      const bal = await cfd.balanceOf(account);
      setCfdBalance(ethers.formatEther(bal));
    } catch (e) {
      console.error(e);
      alert("Withdraw failed (check deadline, goal, or role).");
    }
  }


  // Crée une nouvelle campagne via la factory connectée.
  async function handleCreateCampaign() {
    if (!factory || !account) {
      alert("Connect your wallet first");
      return;
    }


    try {
      const goalWei = ethers.parseEther(newGoal);
      const durationSec = BigInt(newDuration);


      const provider = new ethers.BrowserProvider(window.ethereum);


      const tx = await factory.createCampaign(goalWei, durationSec);
      await tx.wait();


      await loadCampaigns(factory, provider);


      const balWei = await provider.getBalance(account);
      setEthBalance(ethers.formatEther(balWei));
    } catch (e) {
      console.error(e);
      alert("Create campaign failed.");
    }
  }


  // Marque une campagne comme échouée et demande un remboursement pour l'appelant.
  async function handleRefund(campaignAddress) {
    if (!window.ethereum || !account) {
      alert("Connect your wallet first");
      return;
    }


    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();


    const campaign = new ethers.Contract(
      campaignAddress,
      CAMPAIGN_ABI,
      signer
    );


    try {
      const tx = await campaign.refund();
      await tx.wait();


      await loadCampaigns(factory, provider);


      const balWei = await provider.getBalance(account);
      setEthBalance(ethers.formatEther(balWei));
    } catch (e) {
      console.error(e);
      alert("Refund failed (check deadline/state/contribution).");
    }
  }


  // Réclame un remboursement déjà disponible sur une campagne échouée.
  async function handleClaimRefund(campaignAddress) {
    if (!window.ethereum || !account) {
      alert("Connect your wallet first");
      return;
    }


    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();


    const campaign = new ethers.Contract(
      campaignAddress,
      CAMPAIGN_ABI,
      signer
    );


    try {
      const tx = await campaign.claimRefund();
      await tx.wait();


      await loadCampaigns(factory, provider);


      const balWei = await provider.getBalance(account);
      setEthBalance(ethers.formatEther(balWei));
    } catch (e) {
      console.error(e);
      alert("Claim refund failed (check deadline/state/contribution).");
    }
  }


  // Admin-only : change manuellement l'adresse minter du token CFD.
  async function handleChangeMinter() {
    if (!account) {
      alert("Connect your wallet first");
      return;
    }


    if (!newMinter || !ethers.isAddress(newMinter)) {
      alert("Please enter a valid address");
      return;
    }


    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();


      const cfd = new ethers.Contract(CFD_ADDRESS, CFD_ABI, signer);


      const tx = await cfd.setMinter(newMinter);
      await tx.wait();


      alert("Minter updated");
    } catch (e) {
      console.error(e);
      alert("Failed to change minter (are you the token owner?)");
    }
  }


  // Admin-only : déploie une nouvelle factory, la met en minter CFD, et met à jour l'instance utilisée par le frontend.
  async function handleDeployNewFactory() {
    if (!account) {
      alert("Connect your wallet first");
      return;
    }


    if (!FACTORY_BYTECODE || FACTORY_BYTECODE === "0xYourFactoryBytecodeHere") {
      alert("FACTORY_BYTECODE not set in contracts.js");
      return;
    }


    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();


      const FactoryContract = new ethers.ContractFactory(
        FACTORY_ABI_FULL,
        FACTORY_BYTECODE,
        signer
      );


      const newFactory = await FactoryContract.deploy(CFD_ADDRESS);
      await newFactory.waitForDeployment();


      const addr = await newFactory.getAddress();
      setLastFactoryAddress(addr);


      const cfd = new ethers.Contract(CFD_ADDRESS, CFD_ABI, signer);
      const tx = await cfd.setMinter(addr);
      await tx.wait();


      const newFactoryInstance = new ethers.Contract(
        addr,
        FACTORY_ABI,
        signer
      );
      setFactory(newFactoryInstance);
      setCurrentFactoryAddress(addr);


      await loadCampaigns(newFactoryInstance, provider);


      alert(`New factory deployed at: ${addr} and set as CFD minter`);
    } catch (e) {
      console.error(e);
      alert("Failed to deploy new factory or set minter");
    }
  }


  return (
    <div style={{ padding: "1.5rem", fontFamily: "sans-serif" }}>
      <h1>ChainFund Frontend</h1>


      {!account ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div style={{ marginBottom: "1rem" }}>
          <div>Account: {account}</div>
          {network && (
            <div>
              Network: {String(network.chainId)} ({network.name})
            </div>
          )}
          {ethBalance !== null && <div>ETH Balance: {ethBalance} ETH</div>}
          {cfdBalance !== null && <div>CFD Balance: {cfdBalance} CFD</div>}
        </div>
      )}


      {globalRole === "admin" && (
        <div
          style={{
            border: "1px solid red",
            padding: "0.5rem",
            marginBottom: "1rem"
          }}
        >
          <h2>Admin Interface</h2>
          <div>Admin address: {adminAddress}</div>
          <div>Current factory (used by frontend): {currentFactoryAddress}</div>


          <div style={{ marginTop: "1rem" }}>
            <h3>Change CFD minter</h3>
            <input
              type="text"
              placeholder="New minter address"
              value={newMinter}
              onChange={(e) => setNewMinter(e.target.value)}
              style={{ width: "360px", marginRight: "0.5rem" }}
            />
            <button onClick={handleChangeMinter}>Set minter</button>
          </div>


          <div style={{ marginTop: "1rem" }}>
            <h3>Deploy new CampaignFactory</h3>
            <button onClick={handleDeployNewFactory}>
              Deploy new factory (uses current CFD and becomes minter)
            </button>
            {lastFactoryAddress && (
              <div style={{ marginTop: "0.5rem" }}>
                Last deployed factory: {lastFactoryAddress}
              </div>
            )}
          </div>
        </div>
      )}


      {account && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2>Create new campaign</h2>
          <div>
            <label>Goal (ETH): </label>
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              style={{ width: "80px", marginRight: "0.5rem" }}
            />
          </div>
          <div style={{ marginTop: "0.5rem" }}>
            <label>Duration (seconds): </label>
            <input
              type="text"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              style={{ width: "100px", marginRight: "0.5rem" }}
            />
          </div>
          <button style={{ marginTop: "0.5rem" }} onClick={handleCreateCampaign}>
            Create campaign
          </button>
        </div>
      )}


      <hr />


      <h2>Campaigns</h2>


      {campaigns.length === 0 && <p>No campaigns found.</p>}


      {campaigns.map((c) => {
        const role = getRoleForCampaign(c, account);
        const nowSec = Math.floor(Date.now() / 1000);


        let stateLabel =
          c.state === 0 ? "Active" : c.state === 1 ? "Funded" : "Failed";


        const isDeadlinePassed = nowSec >= c.deadline;


        if (c.state === 0 && isDeadlinePassed) {
          stateLabel = "Deadline expired";
        }


        return (
          <div
            key={c.id.toString()}
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "0.75rem",
              marginBottom: "0.75rem"
            }}
          >
            <div>
              <strong>ID:</strong> {c.id.toString()}
            </div>
            <div>
              <strong>Address:</strong> {c.address}
            </div>
            <div>
              <strong>Owner:</strong> {c.owner}
            </div>
            <div>
              <strong>Goal:</strong> {c.goal} ETH
            </div>
            <div>
              <strong>Total contributed:</strong> {c.totalContributed} ETH
            </div>
            <div>
              <strong>Deadline:</strong>{" "}
              {new Date(c.deadline * 1000).toLocaleString()}
            </div>
            <div>
              <strong>State:</strong> {stateLabel}
            </div>
            <div>
              <strong>Your role here:</strong> {role}
            </div>


            {account && c.state === 0 && !isDeadlinePassed && (
              <div style={{ marginTop: "0.5rem" }}>
                <input
                  type="text"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  style={{ width: "80px", marginRight: "0.5rem" }}
                />
                <span>ETH</span>
                <button
                  style={{ marginLeft: "0.5rem" }}
                  onClick={() => handleContribute(c.address)}
                >
                  Contribute
                </button>
              </div>
            )}


            {role === "owner" && c.state === 1 && (
              <div style={{ marginTop: "0.5rem" }}>
                <button onClick={() => handleWithdraw(c.id)}>
                  Withdraw & distribute CFD
                </button>
              </div>
            )}


            {account && c.state === 0 && isDeadlinePassed && (
              <div style={{ marginTop: "0.5rem" }}>
                <button onClick={() => handleRefund(c.address)}>
                  Refund (mark failed & refund you)
                </button>
              </div>
            )}


            {account && c.state === 2 && (
              <div style={{ marginTop: "0.5rem" }}>
                <button onClick={() => handleClaimRefund(c.address)}>
                  Claim refund
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


export default App;
