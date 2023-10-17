# XPortal

A trustless lightweight cross-shard protocol.

#ganache #hardhat

validator.js listen to events and submit block headers.

relayer.js listen to events and pass messages and proofs.

client.js trigger Source.sol.

## Reference

receipt proof https://github.com/PISAresearch/event-proofs

transaction proof https://github.com/lorenzb/proveth

receipt transaction state proof https://github.com/zmitton/eth-proof https://github.com/syscoin/eth-object

## Operation

1. Terminal 1: start ganache network

ganache v7.7.4 (@ganache/cli: 0.8.3, @ganache/core: 0.8.3)

```sh
ganache -p 7545 --wallet.accounts "0x6d922087375998e10beb01be21a8e717ef8a6bc22b9a0ad2a0bee6f69724b754, 1000000000000000000000"
```

2. Terminal 2: deploy contracts and save addresses to contracts.json

```sh
npx hardhat run scripts/deploy.js --network localganache
```

3. Terminal 3: start validator

```sh
node validator.js
```

4. Terminal 4: start relayer

```sh
node relayer.js
```

5. Terminal 5: use client to test xSend

modify client.js to test xSend

```sh
node client.js
```

6. 

modify Source.sol function call1 targetAccount to target address

redeploy contracts

restart validator and relayer

modify client.js to test xCall

use client to test xCall
