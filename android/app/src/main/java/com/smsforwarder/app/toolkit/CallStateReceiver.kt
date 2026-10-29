package com.smsforwarder.app.toolkit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import com.smsforwarder.app.data.PairingStore
import com.smsforwarder.app.net.EventClient
import org.json.JSONObject
import java.util.UUID

class CallStateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (TelephonyManager.ACTION_PHONE_STATE_CHANGED != intent.action) return
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val lastState = prefs.getString(KEY_LAST, null)
        val wasRinging = lastState == TelephonyManager.EXTRA_STATE_RINGING
        prefs.edit().putString(KEY_LAST, state).apply()

        val pairing = PairingStore(context).load() ?: return
        val events = EventClient(context)

        when (state) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                sendCall(events, pairing, "incoming", number)
            }
            TelephonyManager.EXTRA_STATE_IDLE -> {
                if (wasRinging) {
                    sendCall(events, pairing, "missed", number)
                }
            }
        }
    }

    private fun sendCall(
        events: EventClient,
        pairing: com.smsforwarder.app.protocol.PairingConfig,
        type: String,
        number: String?,
    ) {
        val event = JSONObject().apply {
            put("type", "call")
            put("id", UUID.randomUUID().toString())
            put("callType", type)
            put("number", number ?: "")
            put("timestamp", System.currentTimeMillis())
        }
        events.sendEvent(pairing, event)
    }

    companion object {
        private const val PREFS = "call_state"
        private const val KEY_LAST = "last"
    }
}
