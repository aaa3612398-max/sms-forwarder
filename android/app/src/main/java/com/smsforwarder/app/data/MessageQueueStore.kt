package com.smsforwarder.app.data

import android.content.Context
import com.smsforwarder.app.protocol.ProtocolCrypto
import org.json.JSONArray
import org.json.JSONObject

class MessageQueueStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun enqueue(payload: ProtocolCrypto.SmsPayload) {
        val list = loadRaw().apply {
            put(
                JSONObject().apply {
                    put("id", payload.id)
                    put("sender", payload.sender)
                    put("body", payload.body)
                    put("timestamp", payload.timestamp)
                    put("simSlot", payload.simSlot)
                },
            )
        }
        prefs.edit().putString(KEY, list.toString()).apply()
    }

    fun peek(): ProtocolCrypto.SmsPayload? {
        val arr = loadRaw()
        if (arr.length() == 0) return null
        val o = arr.getJSONObject(0)
        return ProtocolCrypto.SmsPayload(
            id = o.getString("id"),
            sender = o.getString("sender"),
            body = o.getString("body"),
            timestamp = o.getLong("timestamp"),
            simSlot = if (o.isNull("simSlot")) null else o.getInt("simSlot"),
        )
    }

    fun dequeueHead() {
        val arr = loadRaw()
        if (arr.length() == 0) return
        val next = JSONArray()
        for (i in 1 until arr.length()) next.put(arr.getJSONObject(i))
        prefs.edit().putString(KEY, next.toString()).apply()
    }

    fun count(): Int = loadRaw().length()

    private fun loadRaw(): JSONArray {
        val raw = prefs.getString(KEY, "[]") ?: "[]"
        return JSONArray(raw)
    }

    companion object {
        private const val PREFS = "message_queue"
        private const val KEY = "pending"
    }
}
