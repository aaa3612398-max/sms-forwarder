package com.smsforwarder.app.toolkit

import android.content.Context
import android.os.Build
import android.telephony.SmsManager
import android.telephony.SubscriptionManager

class SmsSendHelper(private val context: Context) {
    data class Result(val ok: Boolean, val error: String? = null)

    fun send(to: String, body: String, simSlot: Int?): Result {
        return try {
            val smsManager = resolveSmsManager(simSlot)
            smsManager.sendTextMessage(to, null, body, null, null)
            Result(true)
        } catch (e: Exception) {
            Result(false, e.message)
        }
    }

    private fun resolveSmsManager(simSlot: Int?): SmsManager {
        if (simSlot == null) return SmsManager.getDefault()
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return SmsManager.getDefault()
        val sm = context.getSystemService(SubscriptionManager::class.java) ?: return SmsManager.getDefault()
        val info = sm.activeSubscriptionInfoList?.firstOrNull { it.simSlotIndex == simSlot }
            ?: return SmsManager.getDefault()
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(SmsManager::class.java)
                .createForSubscriptionId(info.subscriptionId)
        } else {
            @Suppress("DEPRECATION")
            SmsManager.getSmsManagerForSubscriptionId(info.subscriptionId)
        }
    }
}
