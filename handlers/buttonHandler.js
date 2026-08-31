const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { filasMobile, filasEmu, filasMistas } = require('../config/queues');

async function handleButtonInteraction(interaction, client, confirmadosPartida, pixConfig) {
    if (!interaction.isButton()) return;

    const { customId, user, message, guild } = interaction;

    // Coloque aqui a lógica exata que já estava no seu index.js para os botões de fila
    // (entrar, sair, atualizar embed, e chamar a criação da sala privada quando atingir 2 jogadores)
}

async function criarSalaPrivada(guild, client, tipoModo, valorAposta, jogadoresPartida, admId, pixConfig) {
    const categoriaDestino = guild.channels.cache.find(c => c.name === 'PARTIDAS' && c.type === ChannelType.GuildCategory);

    const canalPrivado = await guild.channels.create({
        name: `partida-${tipoModo}`,
        type: ChannelType.GuildText,
        parent: categoriaDestino ? categoriaDestino.id : null,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            ...jogadoresPartida.map(pid => ({
                id: typeof pid === 'object' ? pid.id : pid,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            })),
            { id: admId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
    });

    confirmadosPartida.set(canalPrivado.id, []);
    const medConfig = pixConfig[admId] || { chave: 'Não configurada', nome: 'Não configurado' };

    const embedApostaCriada = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('SAMURAI E-SPORTS | Canal de Aposta ✅')
        .addFields(
            { name: 'Modo:', value: `${tipoModo}` },
            { name: 'Chave Pix:', value: `\`${medConfig.chave}\`` },
            { name: 'Nome Completo:', value: `\`${medConfig.nome}\`` }
        );

    await canalPrivado.send({ embeds: [embedApostaCriada] });
}

module.exports = { handleButtonInteraction, criarSalaPrivada };
