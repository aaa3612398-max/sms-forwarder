package com.smsforwarder.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

enum class ForwardStatus { OK, PENDING, FAILED }

data class ForwardLogEntry(
    val id: String,
    val sender: String,
    val bodyPreview: String,
    val timestamp: Long,
    val status: ForwardStatus,
)

class ForwardLogStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun add(entry: ForwardLogEntry) {
        val list = load().toMutableList()
        list.add(0, entry)
        while (list.size > MAX) list.removeLast()
        save(list)
    }

    fun updateStatus(id: String, status: ForwardStatus) {
        val list = load().map {
            if (it.id == id) it.copy(status = status) else it
        }
        save(list)
    }

    fun load(): List<ForwardLogEntry> {
        val raw = prefs.getString(KEY, "[]") ?: "[]"
        val arr = JSONArray(raw)
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(
                    ForwardLogEntry(
                        id = o.getString("id"),
                        sender = o.getString("sender"),
                        bodyPreview = o.getString("bodyPreview"),
                        timestamp = o.getLong("timestamp"),
                        status = ForwardStatus.valueOf(o.getString("status")),
                    ),
                )
            }
        }
    }

    private fun save(list: List<ForwardLogEntry>) {
        val arr = JSONArray()
        list.forEach { e ->
            arr.put(
                JSONObject().apply {
                    put("id", e.id)
                    put("sender", e.sender)
                    put("bodyPreview", e.bodyPreview)
                    put("timestamp", e.timestamp)
                    put("status", e.status.name)
                },
            )
        }
        prefs.edit().putString(KEY, arr.toString()).apply()
    }

    companion object {
        private const val PREFS = "forward_log"
        private const val KEY = "entries"
        private const val MAX = 50
    }
}
