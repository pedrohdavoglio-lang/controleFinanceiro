# Meu Financeiro — Validação de Ciclo

Aplicação estática funcional com `localStorage`.

## Ajuste principal desta versão

Todos os lançamentos com data validam a data contra o ciclo ativo:

- Gastos à vista
- Compras parceladas
- A Receber
- A Pagar

Se a data estiver fora do ciclo ativo, o sistema bloqueia o salvamento e exibe alerta.

## Como rodar

Abra `index.html` no navegador.

Ou rode:

```bash
python3 -m http.server 8000
```

## GitHub Pages

Suba os arquivos na raiz do repositório e ative Pages em Settings > Pages.


## Correção desta versão

- Ao encerrar o ciclo, o snapshot é salvo em `state.history`.
- A aplicação redireciona automaticamente para a aba Histórico.
- O histórico agora mostra cards e detalhes do ciclo encerrado.
