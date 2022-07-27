# Backend

NFTY Backend Protocol Development

## NFTY Token

### Installation

Install all the dependencies with npm, run the following command

```bash
npm install
```

### Testing

To test the contract, run the following command

```bash
npm run test
```

To clean all the temp files from the test, run the following command

```bash
npm run clean
```

### Deployment

Create a secrets.json file in the root directory and add the following variables

```json
{
	"mnemonic": "your-mnemonic",
	"infuraKey": "your-infura-key"
}
```

To deploy to a network, run the following command by replacing the `NETWORK` with one of the following valid values:

-   mainnet
-   ropsten
-   rinkeby
-   goerli
-   localhost

```bash
npx hardhat run --network NETWORK scripts/deploy_upgradable_token.js
```

---

**NOTE**

> Save the deployed contract address as it would be required to upgrade the contract

---
