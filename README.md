# MobilePay Subscriptions
Easily integrate with MobilePay Subscriptions without entering an agreement with a 3rd party PSP.
## Usage
### Install the package
```console
npm install --save mobilepay-subscriptions 
```
### Integrate
```typescript
import { Client as MPSClient } from "mobilepay-subscriptions";

const client = MPSClient({
    discoveryEndpoint: ..,
    apiEndpoint: ..,
    merchant: {
        ..
    },
    application: {
        ..
    },
});

await client.initialize();
const response = await client.createAgreement({
    external_id: ..,
    amount: ..,
    ..
});
```
## License
mobilepay-subscriptions is licensed under a [MIT License](./LICENSE.md).
