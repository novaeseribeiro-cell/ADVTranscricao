# Degravador

App de desktop (Windows e Mac) que transcreve gravações de audiência, vídeos, áudios de WhatsApp e ligações **no próprio computador**, com minutagem clicável, marcação de trechos e exportação para Word, .txt e legenda .srt.

A leitura jurídica (quem fala, pontos-chave, contradições, citações prontas) é feita pelo Claude do próprio usuário: o app copia a degravação com as instruções, o usuário cola no Claude e traz a resposta de volta. O Degravador confere cada citação palavra por palavra contra a transcrição.

## Como instalar

Baixe o instalador na página **Releases** deste repositório.

- **Windows:** abra o `Degravador-Windows-Setup-x.y.z.exe`. Se aparecer "O Windows protegeu o computador", clique em **Mais informações** e depois em **Executar assim mesmo**.
- **Mac (chip Apple):** abra o `.dmg` e arraste o Degravador para Aplicativos. Se o Mac não deixar abrir, vá em Ajustes do Sistema › Privacidade e Segurança › **Abrir mesmo assim**.

Na primeira abertura, vá na aba **Motor** e baixe o modelo de voz (uma vez só).

## Como gerar uma nova versão

Altere `version` no `package.json`, faça commit e crie uma tag `vX.Y.Z`. O GitHub Actions compila o whisper.cpp, monta os instaladores e publica no Releases.

## Componentes

whisper.cpp (MIT), modelos Whisper (MIT), FFmpeg (LGPL/GPL, via ffmpeg-static) e Electron (MIT). Ver a pasta `LICENSES`.
