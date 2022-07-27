require('@openzeppelin/hardhat-upgrades')
require('@nomiclabs/hardhat-waffle')
require('hardhat-gas-reporter')
const { mnemonic, infuraKey } = require('./secrets.json')

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
	networks: {
		mainnet: {
			url: `https://mainnet.infura.io/v3/${infuraKey}`,
			accounts: { mnemonic: mnemonic },
		},
		ropsten: {
			url: `https://ropsten.infura.io/v3/${infuraKey}`,
			accounts: { mnemonic: mnemonic },
		},
		rinkeby: {
			url: `https://rinkeby.infura.io/v3/${infuraKey}`,
			accounts: { mnemonic: mnemonic },
		},
		goerli: {
			url: `https://goerli.infura.io/v3/${infuraKey}`,
			accounts: { mnemonic: mnemonic },
		},
		localhost: {
			url: 'http://localhost:8545',
		},
	},
	solidity: '0.8.0',
	settings: {
		optimizer: {
			enabled: true,
			runs: 200,
		},
	},
	gasReporter: {
		currency: 'NFTY',
		gasPrice: 21
	}
}
