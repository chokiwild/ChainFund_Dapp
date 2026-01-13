// src/App.jsx
import { useState } from "react";
import { ethers } from "ethers";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  CAMPAIGN_ABI,
  CFD_ADDRESS,
  CFD_ABI
} from "./contracts";
import "./App.css";

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
  const [newGoal, setNewGoal] = useState("1"); // en ETH
  const [newDuration, setNewDuration] = useState("3600"); // en secondes

  // adresse de la factory utilisée par le frontend (lecture seule)
  const [currentFactoryAddress, setCurrentFactoryAddress] = useState(
    FACTORY_ADDRESS
  );

  // Connexion à MetaMask, récupération des infos de base et initialisation des contrats.
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

  return (
    <div className="app-root">
      <header className="app-header">
        <div>
          <h1 className="app-title">ChainFund</h1>
          <p className="app-subtitle">
            Plateforme de crowdfunding avec récompenses en CFD.
          </p>
        </div>

        <div className="wallet-block">
          {!account ? (
            <button className="primary-btn" onClick={connectWallet}>
              Connecter le wallet
            </button>
          ) : (
            <>
              <div className="wallet-line">
                <span className="label">Compte</span>
                <span className="value mono">{account}</span>
              </div>
              {network && (
                <div className="wallet-line">
                  <span className="label">Réseau</span>
                  <span className="value">
                    {String(network.chainId)} ({network.name})
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {account && (
        <section className="balances-row">
          <div className="card small-card">
            <h2>Solde ETH</h2>
            <p className="balance">
              {ethBalance !== null ? `${ethBalance} ETH` : "-"}
            </p>
          </div>
          <div className="card small-card">
            <h2>Solde CFD</h2>
            <p className="balance">
              {cfdBalance !== null ? `${cfdBalance} CFD` : "-"}
            </p>
          </div>
        </section>
      )}

      {globalRole === "admin" && (
        <section className="card admin-card">
          <h2>Informations admin</h2>
          <div className="info-row">
            <span className="label">Adresse admin</span>
            <span className="value mono">{adminAddress}</span>
          </div>
          <div className="info-row">
            <span className="label">Factory actuelle</span>
            <span className="value mono">{currentFactoryAddress}</span>
          </div>
        </section>
      )}

      {account && (
        <section className="card form-card">
          <h2>Créer une nouvelle campagne</h2>
          <div className="form-row">
            <label>Objectif (ETH)</label>
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Durée (secondes)</label>
            <input
              type="text"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
            />
          </div>
          <button className="primary-btn" onClick={handleCreateCampaign}>
            Lancer la campagne
          </button>
        </section>
      )}

      <section className="card list-card">
        <h2>Campagnes</h2>

        {campaigns.length === 0 && (
          <p className="info-text">
            Aucune campagne pour le moment. Connecte ton wallet et crée la
            première.
          </p>
        )}

        <div className="campaign-grid">
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
              <div key={c.id.toString()} className="campaign-card">
                <div className="campaign-header">
                  <span className="campaign-id">#{c.id.toString()}</span>
                  <span
                    className={`badge badge-${stateLabel
                      .toLowerCase()
                      .replace(" ", "-")}`}
                  >
                    {stateLabel}
                  </span>
                </div>

                <div className="campaign-body">
                  <div className="row">
                    <span className="label">Adresse</span>
                    <span className="value mono truncated">{c.address}</span>
                  </div>
                  <div className="row">
                    <span className="label">Owner</span>
                    <span className="value mono truncated">{c.owner}</span>
                  </div>
                  <div className="row">
                    <span className="label">Objectif</span>
                    <span className="value">
                      {c.goal} ETH (reçu {c.totalContributed} ETH)
                    </span>
                  </div>
                  <div className="row">
                    <span className="label">Deadline</span>
                    <span className="value">
                      {new Date(c.deadline * 1000).toLocaleString()}
                    </span>
                  </div>
                  <div className="row">
                    <span className="label">Ton rôle</span>
                    <span className="value role-tag">{role}</span>
                  </div>
                </div>

                <div className="campaign-actions">
                  {account && c.state === 0 && !isDeadlinePassed && (
                    <div className="contribute-row">
                      <input
                        type="text"
                        value={contributeAmount}
                        onChange={(e) => setContributeAmount(e.target.value)}
                      />
                      <span className="suffix">ETH</span>
                      <button
                        className="primary-btn small"
                        onClick={() => handleContribute(c.address)}
                      >
                        Contribuer
                      </button>
                    </div>
                  )}

                  {role === "owner" && c.state === 1 && (
                    <button
                      className="secondary-btn full"
                      onClick={() => handleWithdraw(c.id)}
                    >
                      Retirer les fonds & distribuer les CFD
                    </button>
                  )}

                  {account && c.state === 0 && isDeadlinePassed && (
                    <button
                      className="secondary-btn full"
                      onClick={() => handleRefund(c.address)}
                    >
                      Demander un remboursement
                    </button>
                  )}

                  {account && c.state === 2 && (
                    <button
                      className="secondary-btn full"
                      onClick={() => handleClaimRefund(c.address)}
                    >
                      Récupérer mon remboursement
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="app-footer">
        <span>ChainFund · Projet HEPIA</span>
      </footer>
    </div>
  );
}

export default App;
