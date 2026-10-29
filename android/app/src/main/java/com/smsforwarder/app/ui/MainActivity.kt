package com.smsforwarder.app.ui

import android.Manifest
import android.content.BroadcastReceiver
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.smsforwarder.app.R
import com.smsforwarder.app.data.ForwardLogStore
import com.smsforwarder.app.data.MessageQueueStore
import com.smsforwarder.app.data.PairingStore
import com.smsforwarder.app.databinding.ActivityMainBinding
import com.smsforwarder.app.net.EventClient
import com.smsforwarder.app.service.ForwardService
import com.smsforwarder.app.toolkit.NotificationFilterStore
import com.smsforwarder.app.toolkit.PhoneEventHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private val adapter = ForwardLogAdapter()
    private val pairingStore by lazy { PairingStore(this) }
    private val logStore by lazy { ForwardLogStore(this) }
    private val filterStore by lazy { NotificationFilterStore(this) }
    private val scope = CoroutineScope(Dispatchers.Main)

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { refreshUi() }

    private val scanLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) {
        refreshUi()
        if (pairingStore.isPaired()) ForwardService.start(this)
    }

    private val pickFileLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        uri ?: return@registerForActivityResult
        sendFileUri(uri)
    }

    private val uiReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            refreshUi()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.recentList.layoutManager = LinearLayoutManager(this)
        binding.recentList.adapter = adapter

        binding.btnScan.setOnClickListener {
            ensurePermissions()
            scanLauncher.launch(Intent(this, PairScanActivity::class.java))
        }
        binding.btnStartService.setOnClickListener {
            ensurePermissions()
            ForwardService.start(this)
            refreshUi()
        }
        binding.btnSendClipboard.setOnClickListener { sendClipboardNow() }
        binding.btnPickFile.setOnClickListener {
            if (!pairingStore.isPaired()) {
                Toast.makeText(this, "请先配对", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            pickFileLauncher.launch(arrayOf("*/*"))
        }
        binding.switchMirror.isChecked = filterStore.isMirrorEnabled()
        binding.switchMirror.setOnCheckedChangeListener { _, checked ->
            filterStore.setMirrorEnabled(checked)
        }
        binding.btnNotificationAccess.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
        binding.blockedPackages.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) saveBlockedPackages()
        }

        ensurePermissions()
        refreshUi()
        binding.blockedPackages.setText(filterStore.getBlockedPackages().joinToString(","))
        if (pairingStore.isPaired()) ForwardService.start(this)
    }

    override fun onPause() {
        saveBlockedPackages()
        super.onPause()
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(ForwardService.ACTION_UI_REFRESH)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(uiReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(uiReceiver, filter)
        }
    }

    override fun onStop() {
        super.onStop()
        unregisterReceiver(uiReceiver)
    }

    private fun saveBlockedPackages() {
        val raw = binding.blockedPackages.text?.toString().orEmpty()
        val set = raw.split(',', '\n', ' ')
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toSet()
        filterStore.setBlockedPackages(set)
    }

    private fun sendClipboardNow() {
        val pairing = pairingStore.load()
        if (pairing == null) {
            Toast.makeText(this, "请先配对", Toast.LENGTH_SHORT).show()
            return
        }
        val cm = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
        val text = cm.primaryClip?.takeIf { it.description.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN) }
            ?.getItemAt(0)?.coerceToText(this)?.toString()
        if (text.isNullOrBlank()) {
            Toast.makeText(this, "剪贴板为空", Toast.LENGTH_SHORT).show()
            return
        }
        val handler = PhoneEventHandler(this, EventClient(this))
        scope.launch(Dispatchers.IO) {
            handler.sendClipboard(pairing, text)
            runOnUiThread { Toast.makeText(this@MainActivity, "已发送剪贴板", Toast.LENGTH_SHORT).show() }
        }
    }

    private fun sendFileUri(uri: Uri) {
        val pairing = pairingStore.load() ?: return
        val handler = PhoneEventHandler(this, EventClient(this))
        scope.launch(Dispatchers.IO) {
            val ok = runCatching {
                val name = uri.lastPathSegment ?: "file.bin"
                val mime = contentResolver.getType(uri) ?: "application/octet-stream"
                val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@runCatching false
                if (bytes.size > 10 * 1024 * 1024) return@runCatching false
                handler.sendFile(pairing, name, mime, bytes)
                true
            }.getOrDefault(false)
            runOnUiThread {
                Toast.makeText(this@MainActivity, if (ok) "文件已发送" else "发送失败", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun ensurePermissions() {
        val needed = mutableListOf<String>()
        for (p in listOf(
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_PHONE_STATE,
        )) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                needed.add(p)
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (needed.isNotEmpty()) permissionLauncher.launch(needed.toTypedArray())
    }

    private fun refreshUi() {
        val pairing = pairingStore.load()
        binding.statusText.text = if (pairing != null) {
            getString(R.string.status_paired, pairing.host, pairing.port)
        } else {
            getString(R.string.status_not_paired)
        }
        binding.queueText.text = "队列：${MessageQueueStore(this).count()} 条待发送"
        adapter.submit(logStore.load())
    }

    companion object {
        private const val RECEIVER_NOT_EXPORTED = Context.RECEIVER_NOT_EXPORTED
    }
}
