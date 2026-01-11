// src/contracts.js


// Adresses déployées pour l'environnement actuel
export const FACTORY_ADDRESS = "0x53d5d969B44d8D3Ab5e39cF9cb24F49822aCB00a";
export const CFD_ADDRESS = "0xBDFe69e58dF421F7C6077d66a87CeC546d197d22";


// ABI minimale de la CampaignFactory utilisée par le frontend
export const FACTORY_ABI = [
  {
    inputs: [],
    name: "admin",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getCampaignsCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "campaignId", type: "uint256" }],
    name: "getCampaign",
    outputs: [
      { internalType: "address", name: "campaignAddress", type: "address" },
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "goal", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "bool", name: "exists", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "campaignId", type: "uint256" }],
    name: "withdrawCampaign",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_goal", type: "uint256" },
      {
        internalType: "uint256",
        name: "_durationInSeconds",
        type: "uint256"
      }
    ],
    name: "createCampaign",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];


// Si tu veux plus de méthodes disponibles, remplace par l'ABI complète de l'artifact.
export const FACTORY_ABI_FULL = FACTORY_ABI;


// Bytecode utilisé pour déployer de nouvelles factories depuis le panneau admin
export const FACTORY_BYTECODE = "0xYourFactoryBytecodeHere";


// ABI d'une instance de Campaign
export const CAMPAIGN_ABI = [
  {
    inputs: [],
    name: "goal",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalContributed",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "deadline",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "state",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "contribute",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [],
    name: "refund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "claimRefund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];


// ABI minimale de CFD de type ERC20 (seulement ce dont l'UI a besoin)
export const CFD_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "minter",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "_minter", type: "address" }],
    name: "setMinter",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];
