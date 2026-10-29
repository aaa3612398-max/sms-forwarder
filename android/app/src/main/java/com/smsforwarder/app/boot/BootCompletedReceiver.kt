package com.smsforwarder.app.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.smsforwarder.app.data.PairingStore
import com.smsforwarder.app.service.ForwardService

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (Intent.ACTION_BOOT_COMPLETED != intent.action) return
        if (!PairingStore(context).isPaired()) return
        ForwardService.start(context)
    }
}
