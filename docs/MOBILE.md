# Aplicativos Android e iOS (Expo)

## Desenvolvimento

```bash
cd apps/mobile
npm install
cp ../.env.example .env  # preencha EXPO_PUBLIC_API_URL com IP:porta da API
npm start                # Expo Dev Server (QR code)
npm run android          # dispositivo/emulador Android
npm run ios              # simulator iOS (requer macOS + Xcode)
```

Em dispositivo físico, `localhost` do celular não é o computador: use o IP da rede local (ex.: `http://192.168.1.10:4000`). O WebSocket usa `EXPO_PUBLIC_WS_HOST` no mesmo IP.

## Bundles já validados

```bash
npx expo export --platform android
npx expo export --platform ios
```

Ambos geraram bundles Hermes com sucesso neste workspace (Android 1,64 MB; iOS 1,63 MB). Isso valida o JavaScript, mas **não** é um APK/IPA instalável.

## Build instalável (EAS)

```bash
npm install -g eas-cli
eas login
cd apps/mobile
eas build:configure           # gera eas.json e vincula o projectId
eas build --platform android  # gera AAB (recomendado) ou APK
eas build --platform ios      # requer Apple Developer Program
```

Substitua `CONFIGURE_EAS_PROJECT_ID` em `app.json` pelo ID do projeto Expo. Para iOS, EAS gerencia certificados e provisioning quando as credenciais da conta Apple são fornecidas.

## Publicação nas lojas

- **Google Play:** submeta o AAB, preencha ficha, política de privacidade (use `/privacidade`), classificação ee o teste interno.
- **App Store:**Use o Transporter ou EAS submit, informe a URL da política de privacidade e o escopo de localização (a localização só é usada durante entregas, com consentimento).

**Status:** aplicativos implementados e bundles validados; **não submetidos nem aprovados** nas lojas. Isso depende de contas de desenvolvedor e builds EAS com credenciais do proprietário.

## Telas incluídas

Consumidor: login/cadastro, início com busca/categorias, loja e produtos com adicionais, carrinho, checkout, acompanhamento, histórico, conversas, perfil/LGPD. Entregador: cadastro, online/offline, solicitações, aceite atômico, retirada/entrega, localização e ganhos. Gestão de lojas e administração são web (painéis responsivos).

## Localização do entregador

O app solicita permissão de localização em primeiro plano e obtém uma leitura real ao entrar online ou tocar em compartilhar durante a entrega. Não implementa rastreamento contínuo nem segundo plano. Para navegação, botões abrem Google Maps com o endereço após aceite e informam o compartilhamento. Precisam ser testados em aparelhos físicos; a exportação do bundle não valida GPS, permissões ou navegação.
