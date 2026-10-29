package com.smsforwarder.app.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.smsforwarder.app.R
import com.smsforwarder.app.data.ForwardLogStore
import com.smsforwarder.app.data.ForwardStatus
import com.smsforwarder.app.data.MessageQueueStore
import com.smsforwarder.app.data.PairingStore
import com.smsforwarder.app.net.MessageClient
import com.smsforwarder.app.protocol.ProtocolCrypto
import com.smsforwarder.app.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class ForwardService : Service() {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private val client = MessageClient()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, buildNotification())
        scope.launch { drainLoop() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_ENQUEUE -> {
                val id = intent.getStringExtra(EXTRA_ID) ?: return START_STICKY
                val sender = intent.getStringExtra(EXTRA_SENDER) ?: return START_STICKY
                val body = intent.getStringExtra(EXTRA_BODY) ?: return START_STICKY
                val timestamp = intent.getLongExtra(EXTRA_TIMESTAMP, System.currentTimeMillis())
                val simSlot = intent.getIntExtra(EXTRA_SIM_SLOT, Int.MIN_VALUE).let {
                    if (it == Int.MIN_VALUE) null else it
                }
                enqueue(
                    ProtocolCrypto.SmsPayload(id, sender, body, timestamp, simSlot),
                )
            }
            ACTION_FLUSH -> scope.launch { flushOnce() }
        }
        return START_STICKY
    }

    private fun enqueue(payload: ProtocolCrypto.SmsPayload) {
        val queue = MessageQueueStore(this)
        val log = ForwardLogStore(this)
        queue.enqueue(payload)
        log.add(
            com.smsforwarder.app.data.ForwardLogEntry(
                id = payload.id,
                sender = payload.sender,
                bodyPreview = payload.body.take(80),
                timestamp = payload.timestamp,
                status = ForwardStatus.PENDING,
            ),
        )
        sendBroadcast(Intent(ACTION_UI_REFRESH))
        scope.launch { flushOnce() }
    }

    private suspend fun drainLoop() {
        while (scope.isActive) {
            flushOnce()
            delay(15_000)
        }
    }

    private suspend fun flushOnce() {
        val pairing = PairingStore(this).load() ?: return
        val queue = MessageQueueStore(this)
        val log = ForwardLogStore(this)
        while (true) {
            val head = queue.peek() ?: break
            val ok = runCatching { client.send(pairing, head) }.getOrDefault(false)
            if (ok) {
                log.updateStatus(head.id, ForwardStatus.OK)
                queue.dequeueHead()
                sendBroadcast(Intent(ACTION_UI_REFRESH))
            } else {
                log.updateStatus(head.id, ForwardStatus.FAILED)
                break
            }
        }
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.service_notification_title))
            .setContentText(getString(R.string.service_notification_text))
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "forward_service"
        private const val NOTIFICATION_ID = 1001

        const val ACTION_ENQUEUE = "com.smsforwarder.app.ENQUEUE"
        const val ACTION_FLUSH = "com.smsforwarder.app.FLUSH"
        const val ACTION_UI_REFRESH = "com.smsforwarder.app.UI_REFRESH"

        const val EXTRA_ID = "id"
        const val EXTRA_SENDER = "sender"
        const val EXTRA_BODY = "body"
        const val EXTRA_TIMESTAMP = "timestamp"
        const val EXTRA_SIM_SLOT = "simSlot"

        fun enqueueSms(context: Context, payload: ProtocolCrypto.SmsPayload) {
            val intent = Intent(context, ForwardService::class.java).apply {
                action = ACTION_ENQUEUE
                putExtra(EXTRA_ID, payload.id)
                putExtra(EXTRA_SENDER, payload.sender)
                putExtra(EXTRA_BODY, payload.body)
                putExtra(EXTRA_TIMESTAMP, payload.timestamp)
                if (payload.simSlot != null) putExtra(EXTRA_SIM_SLOT, payload.simSlot)
            }
            context.startForegroundService(intent)
        }

        fun start(context: Context) {
            context.startForegroundService(Intent(context, ForwardService::class.java))
        }
    }
}
