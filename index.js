const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});


const VALORES_APOSTA = [100.00, 80.00, 50.00, 30.00, 15.00, 10.00, 5.00, 3.00, 2.00, 1.00, 0.80, 0.50];
const filas = new Map();
const confirmacoes = new Map();

function formatarMoeda(valor) {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!')) return;

  const comando = message.content.toLowerCase();

  // Limpeza segura sem dar crash no Node.js
  if (comando === '!limpar' || comando === '!clear') {
    try {
      await message.delete().catch(() => {});
      const fetched = await message.channel.messages.fetch({ limit: 50 });
      for (const msg of fetched.values()) {
        await msg.delete().catch(() => {});
      }
    } catch (e) {
      console.log("Erro ao limpar mensagens:", e);
    }
    return;
  }

  if (!comando.startsWith('!postar')) return;

  const ehEmu = comando.includes('emu');
  const tipoPlataforma = ehEmu ? 'EMULADOR' : 'MOBILE';
  const tipoModo = comando.replace('!postar', '').replace('emu', '').toUpperCase();

  const modosValidos = ['1X1', '2X2', '3X3', '4X4'];

  if (modosValidos.includes(tipoModo)) {
    await message.delete().catch(() => {});

    for (const valor of VALORES_APOSTA) {
      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${tipoModo} ${tipoPlataforma} | BLEND APOSTAS`)
        .setColor('#2B2D31')
        .setDescription(
          `Clique abaixo para escolher sua modalidade e entrar na fila!\n\n` +
          `💰 **Aposta:**\n` +
          `${formatarMoeda(valor)} (+ R$ 0,20 Taxa ADM)\n\n` +
          `👤 **Jogadores na Fila (0/2):**\n` +
          `Nenhum jogador na fila`
        );

      let botoes = new ActionRowBuilder();

      if (tipoModo === '1X1') {
        botoes.addComponents(
          new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Normal`).setLabel('Gelo Normal').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Infinito`).setLabel('Gelo Infinito').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
        );
      } else {
        botoes.addComponents(
          new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Normal`).setLabel('NORMAL').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Full Ump Xm8`).setLabel('FULL UMP XM8').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('SAIR').setStyle(ButtonStyle.Secondary)
        );
      }

      await message.channel.send({ embeds: [embed], components: [botoes] });
    }
  }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    await interaction.deferUpdate().catch(() => {});

    const partes = interaction.customId.split('|');
  const [acao, modo, valorStr, opcaoEscolhida] = partes;
  const valor = parseFloat(valorStr);
  const chaveFila = `${interaction.message.id}`;

  if (!filas.has(chaveFila)) {
    filas.set(chaveFila, []);
  }

  let listaJogadores = filas.get(chaveFila);

  if (acao === 'entrar') {
    const jaNaFila = listaJogadores.some(j => j.id === interaction.user.id);
    if (jaNaFila) {
      return interaction.reply({ content: '❌ Você já está nesta fila!', ephemeral: true });
    }

    if (listaJogadores.length >= 2) {
      return interaction.reply({ content: '⚠️ Esta fila já está cheia (2/2)!', ephemeral: true });
    }

    listaJogadores.push({ id: interaction.user.id, opcao: opcaoEscolhida });
  } else if (acao === 'sair') {
    const index = listaJogadores.findIndex(j => j.id === interaction.user.id);
    if (index !== -1) {
      listaJogadores.splice(index, 1);
      filas.set(chaveFila, listaJogadores);
    } else {
      return interaction.reply({ content: '❌ Você não está nesta fila!', ephemeral: true });
    }
  } else if (acao === 'conf_aposta') {
    if (!confirmacoes.has(chaveFila)) {
      confirmacoes.set(chaveFila, []);
    }
    let listaConfirmados = confirmacoes.get(chaveFila);

    const estaNaPartida = listaJogadores.some(j => j.id === interaction.user.id);
    if (!estaNaPartida) {
      return interaction.reply({ content: '❌ Você não faz parte desta partida!', ephemeral: true });
    }

    if (listaConfirmados.includes(interaction.user.id)) {
      return interaction.reply({ content: '⚠️ Você já confirmou sua aposta!', ephemeral: true });
    }

    listaConfirmados.push(interaction.user.id);

    if (listaConfirmados.length === 2) {
      const valorTotal = valor + CONFIG.TAXA_ADM;
      const jog1 = listaJogadores[0];
      const jog2 = listaJogadores[1];

      await interaction.update({
        content: `✅ **PARTIDA CONFIRMADA POR AMBOS (2/2)!**`,
        components: []
      }).catch(() => {});

      await interaction.channel.send(
        `🚀 **PAGAMENTO DA APOSTA (${modo})!**\n` +
        `⚔️ <@${jog1.id}> (${jog1.opcao}) VS <@${jog2.id}> (${jog2.opcao})\n\n` +
        `💰 **Valor Total (Aposta + Taxa):** **${formatarMoeda(valorTotal)}**\n` +
        `👤 **Favorecido (Nome no Banco):** \`${CONFIG.NOME_TITULAR}\`\n` +
        `🔑 **Chave PIX:** \`${CONFIG.CHAVE_PIX}\`\n\n` +
        `⚠️ *Confirme se o nome acima está certinho antes de realizar o Pix!* Após pagar, envie o comprovante para o <@&${CONFIG.ID_CARGO_ADM}>!`
      );

      filas.set(chaveFila, []);
      confirmacoes.delete(chaveFila);

      const embedOriginal = interaction.message.embeds[0];
      const embedReset = EmbedBuilder.from(embedOriginal)
        .setDescription(
          `Clique abaixo para escolher sua modalidade e entrar na fila!\n\n` +
          `💰 **Aposta:**\n` +
          `${formatarMoeda(valor)} (+ R$ 0,20 Taxa ADM)\n\n` +
          `👤 **Jogadores na Fila (0/2):**\n` +
          `Nenhum jogador na fila`
        );
      
      const msgCanal = await interaction.channel.messages.fetch(interaction.message.id).catch(() => null);
      if (msgCanal) {
        let botoesNovos = new ActionRowBuilder();
        if (modo === '1X1') {
          botoesNovos.addComponents(
            new ButtonBuilder().setCustomId(`entrar|${modo}|${valor}|Gelo Normal`).setLabel('Gelo Normal').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`entrar|${modo}|${valor}|Gelo Infinito`).setLabel('Gelo Infinito').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`sair|${modo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
          );
        } else {
          botoesNovos.addComponents(
            new ButtonBuilder().setCustomId(`entrar|${modo}|${valor}|Normal`).setLabel('NORMAL').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`entrar|${modo}|${valor}|Full Ump Xm8`).setLabel('FULL UMP XM8').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`sair|${modo}|${valor}|Sair`).setLabel('SAIR').setStyle(ButtonStyle.Secondary)
          );
        }
        await msgCanal.edit({ embeds: [embedReset], components: [botoesNovos] }).catch(() => {});
      }
      return;
    } else {
      return interaction.update({
        content: `⏳ **Aguardando confirmação (${listaConfirmados.length}/2)...**\nConfirmado por: <@${interaction.user.id}>`,
        components: interaction.message.components
      }).catch(() => {});
    }
  }

  await interaction.deferUpdate().catch(() => {});

  const textoJogadores = listaJogadores.length > 0 
    ? listaJogadores.map(j => `<@${j.id}> | ${j.opcao}`).join('\n') 
    : 'Nenhum jogador na fila';

  const embedOriginal = interaction.message.embeds[0];
  const novaEmbed = EmbedBuilder.from(embedOriginal)
    .setDescription(
      `Clique abaixo para escolher sua modalidade e entrar na fila!\n\n` +
      `💰 **Aposta:**\n` +
      `${formatarMoeda(valor)} (+ R$ 0,20 Taxa ADM)\n\n` +
      `👤 **Jogadores na Fila (${listaJogadores.length}/2):**\n` +
      `${textoJogadores}`
    );

  await interaction.editReply({ embeds: [novaEmbed] }).catch(() => {});

  if (listaJogadores.length === 2) {
    const jog1 = listaJogadores[0];
    const jog2 = listaJogadores[1];

    confirmacoes.set(chaveFila, []);

    const botoesConfirmacao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`conf_aposta|${modo}|${valor}|confirmar`)
        .setLabel('Confirmar Aposta / Regras')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`sair|${modo}|${valor}|sair`)
        .setLabel('Desistir / Sair')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({
      content: `🚨 **FILA FECHADA (${modo}) - ${formatarMoeda(valor)}!**\n` +
               `Confronto: <@${jog1.id}> (${jog1.opcao}) vs <@${jog2.id}> (${jog2.opcao})\n\n` +
               `Ambos devem conferir as regras e clicar no botão roxo abaixo para **Confirmar a Aposta** (0/2 confirmados):`,
      components: [botoesConfirmacao]
    }).catch(() => {});
  }
});

client.once('ready', () => {
  console.log(`🤖 Bot online como: ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
