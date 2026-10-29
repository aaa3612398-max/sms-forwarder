package com.smsforwarder.app.toolkit

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import com.smsforwarder.app.net.EventClient
import com.smsforwarder.app.protocol.PairingConfig
import com.smsforwarder.app.protocol.ProtocolCrypto
import org.json.JSONObject
import java.util.Base64
import java.util.UUID

class PhoneEventHandler(
    private val context: Context,
    private val eventClient: EventClient,
) {
    private val files = FileReceiveHelper(context)
    private val sms = SmsSendHelper(context)

    fun handleFromDesktop(config: PairingConfig, event: JSONObject) {
        when (event.optString("type")) {
            "clipboard" -> {
                val text = event.getString("text")
                val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("sms-forwarder", text))
            }
            "file_chunk" -> files.onChunk(event)
            "file_end" -> files.onEnd(event)
            "sms_send" -> {
                val id = event.getString("id")
                val result = sms.send(
                    to = event.getString("to"),
                    body = event.getString("body"),
                    simSlot = if (event.isNull("simSlot")) null else event.getInt("simSlot"),
                )
                val ack = JSONObject().apply {
                    put("type", "sms_send_result")
                    put("id", id)
                    put("ok", result.ok)
                    if (result.error != null) put("error", result.error)
                }
                eventClient.sendEvent(config, ack)
            }
        }
    }

    fun sendClipboard(config: PairingConfig, text: String) {
        val event = JSONObject().apply {
            put("type", "clipboard")
            put("id", UUID.randomUUID().toString())
            put("text", text)
            put("timestamp", System.currentTimeMillis())
        }
        eventClient.sendEvent(config, event)
    }

    fun sendFile(config: PairingConfig, name: String, mime: String, bytes: ByteArray) {
        val transferId = UUID.randomUUID().toString()
        val chunkSize = 256 * 1024
        val total = (bytes.size + chunkSize - 1) / chunkSize
        for (i in 0 until total) {
            val start = i * chunkSize
            val end = minOf(bytes.size, start + chunkSize)
            val slice = bytes.copyOfRange(start, end)
            val event = JSONObject().apply {
                put("type", "file_chunk")
                put("transferId", transferId)
                put("name", name)
                put("mime", mime)
                put("index", i)
                put("total", total)
                put("data", Base64.getEncoder().encodeToString(slice))
            }
            eventClient.sendEvent(config, event)
        }
        eventClient.sendEvent(
            config,
            JSONObject().apply {
                put("type", "file_end")
                put("transferId", transferId)
                put("name", name)
                put("totalBytes", bytes.size)
            },
        )
    }

    fun sendSmsPayload(config: PairingConfig, payload: ProtocolCrypto.SmsPayload): Boolean {
        val event = JSONObject().apply {
            put("type", "sms")
            put("id", payload.id)
            put("sender", payload.sender)
            put("body", payload.body)
            put("timestamp", payload.timestamp)
            put("simSlot", payload.simSlot)
        }
        return eventClient.sendEvent(config, event)
    }
}
