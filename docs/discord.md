# Discord Integration

You can send your Beyond 20 rolls to a Discord channel of your choice.

**Note:** the Discord bot is hosted by the **upstream Beyond20 project** at `beyond20.kicks-ass.org`. This fork does not host it, and cannot fix problems with the bot itself. Discord is the one optional feature that sends anything outside your browser. The [Privacy](privacy) page explains exactly what it sends. If you leave the Discord settings empty, nothing is ever sent.

There are three steps.

## 1 - Invite the Beyond20 Discord Bot

First, invite the bot to your Discord server. Click [here](https://beyond20.kicks-ass.org/invite) to do that.

When the bot is in your server, you can send it commands. Try `/info` to learn more.

## 2 - Get your Discord Secret Key

The extension needs to know where to send rolls. It also needs to stop other people from spamming your channels. A `secret key` does both jobs.

If you own the server, send the command `/secret` in any channel the bot has joined. The bot replies with a secret key. That key lets you **send rolls to that channel**. You can share the key with your players, so they can send rolls there too.

You can also name a channel, or a separate channel or user for whispers. Add arguments to the command. For example, `/secret channel #beyond20-rolls` sends rolls to the `#beyond20-rolls` channel. `/secret channel #beyond20-rolls whisper #whisper-rolls` also sends whispers to `#whisper-rolls`. You can use `/secret channel #party-channel whisper-user @DMUser` to send whispers straight to `@DMUser`.

## 3 - Set the Discord Secret Key in Beyond 20

The extension now needs the key. Click the Beyond 20 options menu (the icon in the browser's address bar). Click `More Options`. Scroll down near the end of the options list. Find `Discord Default Destination Channel`, just below the Discord logo.

Click the dropdown list and choose "Add new Channel". Type a name you will remember, such as "Monday Group" or "#my-beyond20-channel". Click `OK`. Type the secret key. Click `OK` again.

You can add as many Discord destinations as you like. Choose the one you want for your default rolls, save your settings, and you are done.

You can also set a different Discord channel for each character. This helps if you have several groups, and you want each character's rolls to go to the right channel. Set the override in the per-character settings. Click the Beyond20 icon on the character sheet page to find them.

# Important notes

Make sure you have link previews turned on. The Discord bot uses embed messages to show its rolls. In Discord's `User Settings`, under `Text & Images`, turn on the option under `Link Preview`.

Roll20 builds its messages in a special way. You can send your rolls to Roll20 or to Discord, but not to both at once. If you use Roll20 as your VTT and want rolls in Discord, click the Beyond20 options icon *inside the Roll20 tab*. Then choose "Send rolls to : D&D Beyond Dice Roller & Discord".

# Whispers and extra options

If you do not name a whisper channel, the whisper setting is ignored when rolls go to Discord. You can name one with the `whisper` option: `/secret whisper #whisper-channel`.

You can add extra options to the bot. The only option at the moment is `spoilers`. It stops the Beyond20 bot from putting spoiler tags around the dice formulas. For example: `/secret spoilers False`.

# Secret key

A secret key cannot be revoked. Keep it private. If it becomes public, someone could spam your channel. If that happens, change the channel's permissions to block the bot, and make a new secret key for a different channel.

You cannot delete a Direct Message channel. If you send rolls as Direct Messages, the only way to stop them is to block the bot, which can cause other problems. It is better to use channels in your server. Make channels just for the Beyond20 bot, so you can delete them if you ever need to.
