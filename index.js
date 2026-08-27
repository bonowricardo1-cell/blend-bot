const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionsBitField } = require('discord.js');
const http = require('http');

const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SAMURAI E-SPORTS bot rodando normal e ativo!\n');
});

server.listen(PORT, () => {
    console.log(`Servidor HTTP ouvindo na porta ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const filas = new Map();
const confirmadosPartida = new Map();
const CARGO_SUPORTE_ID = '1541235665960833145';

// Armazenamento em memória da fila de mediadores e config do Pix
let filaMediadores = [];
let dadosPix = {
    chave: "Não configurada",
    nome: "Não configurado"
};

const limitesFila = {
    '1x1': 2,
    '2x2': 4,
    '3x3': 6,
    '4x4': 8
};

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

client.once('ready', () => {
    console.log(`Bot online como: ${client.user.tag}`);
});

// ==========================================
// CENTRAL DE COMANDOS DE TEXTO (MESSAGE CREATE)
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 1. COMANDO !limpar
    if (message.content.startsWith('!limpar')) {
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

    // 2. COMANDO !ticket
    if (message.content.startsWith('!ticket')) {
        await message.delete().catch(() => {});

        const embedTicket = new EmbedBuilder()
            .setTitle('SAMURAI E-SPORTS | Central de Atendimento 🎫')
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription('📂 Seja bem-vindo(a) ao sistema de atendimento! Aqui você pode abrir um ticket de forma rápida e organizada.\n\n👇 **Selecione uma das opções no menu abaixo para iniciar seu atendimento e aguarde que nossa equipe irá te responder o mais breve possível.**')
            .setColor('#0099ff');

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('criar_ticket')
                .setPlaceholder('Selecione o ticket que deseja abrir')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Suporte')
                        .setDescription('Auxílio, ajudas, dúvidas e propostas...')
                        .setValue('suporte')
                        .setEmoji('💬'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Reembolso')
                        .setDescription('Adm pagou errado, sumiu e precisa de reembolso.')
                        .setValue('reembolso')
                        .setEmoji('💳'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Seja Mediador')
                        .setDescription('Abra ticket aqui para fazer parte da equipe.')
                        .setValue('seja_mediador')
                        .setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Divulgação')
                        .setDescription('Caso queira uma divulgação.')
                        .setValue('divulgacao')
                        .setEmoji('📢')
                )
        );

        await message.channel.send({ embeds: [embedTicket], components: [menuRow] });
        return;
    }

    // 3. COMANDO !postar
    if (message.content.startsWith('!postar')) {
        const args = message.content.trim().split(/\s+/);
        if (args.length < 3) {
            return message.reply('Use o formato correto com espaço: `!postar 1x1 2.00`');
        }

        const tipoModo = args[1];
        const valor = parseFloat(args[2].replace(',', '.'));

        if (isNaN(valor)) {
            return message.reply('❌ Por favor, insira um valor numérico válido, ex: `!postar 1x1 2.00`');
        }

        await message.delete().catch(() => {});
        const taxaAdm = 0.15;
        const maxJogadores = limitesFila[tipoModo.toLowerCase()] || 2;

        const embed = new EmbedBuilder()
            .setTitle(`${tipoModo.toUpperCase()} | SAMURAI E-SPORTS`)
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription(`🎮 Modo: ${tipoModo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Jogadores na Fila (0/${maxJogadores})**`)
            .setColor('#0099ff');

        const botoes = new ActionRowBuilder();

        if (tipoModo.toLowerCase().includes('1x1')) {
            botoes.addComponents(
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Normal`).setLabel('Gelo Normal').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Infinito`).setLabel('Gelo Infinito').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
            );
        } else {
            botoes.addComponents(
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Normal`).setLabel('NORMAL').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Full Ump Xm8`).setLabel('FULL UMP XM8').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
            );
        }

        await message.channel.send({ embeds: [embed], components: [botoes] });
        return;
    }

    // 4. COMANDO !painel (Filas Mistas)
    if (message.content.startsWith('!painel')) {
        const argumentos = message.content.split(' ');
        const tipo = argumentos[1];
        const valorArg = parseFloat((argumentos[2] || '5.00').replace(',', '.'));

        if (!filasMistas[tipo]) {
            return message.reply('❌ Tipo inválido. Use: `!painel 2x2-misto 5.00`, `!painel 3x3-misto 5.00` ou `!painel 4x4-misto 5.00`.');
        }

        const configuracao = filasMistas[tipo];
        configuracao.valor = isNaN(valorArg) ? 5.00 : valorArg;
        const taxaAdm = 0.15;

        const embedPainel = new EmbedBuilder()
            .setTitle(`${configuracao.formato} | SAMURAI E-SPORTS`)
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription(`🎮 Modo:\n${configuracao.formato}\n\n💰 Aposta:\n${formatarMoeda(configuracao.valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👤 Jogadores:\nNenhum jogador na fila`)
            .setColor('#0099ff');

        const linhaBotoes = criarBotoesMisto(tipo);

        await message.channel.send({ embeds: [embedPainel], components: [linhaBotoes] });
        await message.delete().catch(() => {});
        return;
    }

    // 5. COMANDO !fila (Painel de Mediadores)
    if (message.content.toLowerCase() === '!fila') {
        const rowBotoes1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('fila_entrar').setLabel('Entrar').setStyle(ButtonStyle.Primary).setEmoji('➕'),
            new ButtonBuilder().setCustomId('fila_sair').setLabel('Sair').setStyle(ButtonStyle.Danger).setEmoji('➖'),
            new ButtonBuilder().setCustomId('fila_atualizar').setLabel('Atualizar').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
        );

        const rowBotoes2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('fila_limpar').setLabel('Limpar Fila').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        const embedFila = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('⚔️ SAMURAI E-SPORTS | Fila de Mediadores')
            .setDescription(`**O mediador(es) na fila:**\n${filaMediadores.length > 0 ? filaMediadores.map((m, index) => `${index + 1}. <@${m}>`).join('\n') : '⚠️ Atenção – Nenhum mediador na fila\n*Clique em "Entrar" para se adicionar à fila*'}`)
            .setFooter({ text: 'Sistema de Fila Automatizado • Samurai' })
            .setTimestamp();

        await message.channel.send({ embeds: [embedFila], components: [rowBotoes1, rowBotoes2] });
        await message.delete().catch(() => {});
        return;
    }

    // 6. COMANDO !setpix
    if (message.content.toLowerCase().startsWith('!setpix')) {
        const args = message.content.slice(8).trim().split(' | ');
        if (args.length < 2) {
            return message.reply('❌ Use o formato correto: `!setpix SUA_CHAVE | NOME DO TITULAR`');
        }

        dadosPix.chave = args[0];
        dadosPix.nome = args[1];

        const embedPix = new EmbedBuilder()
            .setColor('Green')
            .setTitle('💰 PIX DA ORG CONFIGURADO')
            .setDescription(`**Chave PIX:** \`${dadosPix.chave}\`\n**Titular:** \`${dadosPix.nome}\``)
            .setTimestamp();

        return message.reply({ embeds: [embedPix] });
    }
});

// ==========================================
// SISTEMA DE INTERAÇÕES E BOTÕES
// ==========================================
client.on('interactionCreate', async (interaction) => {
    // Gerenciamento dos botões da Fila de Mediadores
    if (interaction.isButton() && interaction.customId.startsWith('fila_')) {
        const { customId, user, message } = interaction;

        if (customId === 'fila_entrar') {
            if (!filaMediadores.includes(user.id)) {
                filaMediadores.push(user.id);
            }
            await atualizarPainelFila(message);
            return interaction.reply({ content: '✅ Você entrou na fila de mediadores!', ephemeral: true });
        }

        if (customId === 'fila_sair') {
            filaMediadores = filaMediadores.filter(id => id !== user.id);
            await atualizarPainelFila(message);
            return interaction.reply({ content: '❌ Você saiu da fila de mediadores.', ephemeral: true });
        }

        if (customId === 'fila_atualizar') {
            await atualizarPainelFila(message);
            return interaction.reply({ content: '🔄 Fila atualizada!', ephemeral: true });
        }

        if (customId === 'fila_limpar') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Apenas o Dono ou Administradores podem limpar a fila!', ephemeral: true });
            }

            filaMediadores = [];
            await atualizarPainelFila(message);
            return interaction.reply({ content: '🗑️ A fila de mediadores foi limpa com sucesso!', ephemeral: true });
        }
        return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'criar_ticket') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }

        const tipoTicket = interaction.values[0];
        const guild = interaction.guild;
        const usuario = interaction.user;

        try {
            const canalTicket = await guild.channels.create({
                name: `ticket-${tipoTicket}-${usuario.username}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: usuario.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: CARGO_SUPORTE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
                ]
            });

            const embedTicketAberto = new EmbedBuilder()
                .setColor('#0099ff')
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setTitle(`SAMURAI E-SPORTS | Ticket - ${tipoTicket.toUpperCase()}`)
                .setDescription(`Olá <@${usuario.id}>, seu ticket foi aberto com sucesso!\n\nAguarde um momento e nossa equipe de suporte (<@&${CARGO_SUPORTE_ID}>) já irá lhe atender.`);

            const botaoFechar = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fechar_ticket')
                    .setLabel('Fechar Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

            await canalTicket.send({
                content: `<@${usuario.id}> | <@&${CARGO_SUPORTE_ID}>`,
                embeds: [embedTicketAberto],
                components: [botaoFechar]
            });

            await interaction.followUp({ content: `✅ Seu ticket foi criado com sucesso em: <#${canalTicket.id}>`, ephemeral: true }).catch(() => {});
        } catch (e) {
            console.log("Erro ao criar canal de ticket:", e);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao criar o seu ticket.', ephemeral: true }).catch(() => {});
        }
        return;
    }

    if (interaction.isButton() && interaction.customId === 'fechar_ticket') {
        if (!interaction
