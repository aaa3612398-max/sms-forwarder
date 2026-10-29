package com.smsforwarder.app.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SubscriptionManager
import com.smsforwarder.app.protocol.ProtocolCrypto
import com.smsforwarder.app.service.ForwardService
import java.util.UUID

class IncomingSmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (Telephony.Sms.Intents.SMS_RECEIVED_ACTION != intent.action) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (messages.isEmpty()) return

        val sender = messages.first().displayOriginatingAddress ?: "unknown"
        val body = messages.joinToString(separator = "") { it.displayMessageBody.orEmpty() }
        val timestamp = messages.first().timestampMillis
        val simSlot = resolveSimSlot(context, intent)

        val payload = ProtocolCrypto.SmsPayload(
            id = UUID.randomUUID().toString(),
            sender = sender,
            body = body,
            timestamp = timestamp,
            simSlot = simSlot,
        )
        ForwardService.enqueueSms(context, payload)
    }

    private fun resolveSimSlot(context: Context, intent: Intent): Int? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return null
        val subId = intent.getIntExtra("subscription", SubscriptionManager.INVALID_SUBSCRIPTION_ID)
        if (subId == SubscriptionManager.INVALID_SUBSCRIPTION_ID) return null
        val sm = context.getSystemService(SubscriptionManager::class.java) ?: return null
        return sm.activeSubscriptionInfoList
            ?.firstOrNull { it.subscriptionId == subId }
            ?.simSlotIndex
    }
}
