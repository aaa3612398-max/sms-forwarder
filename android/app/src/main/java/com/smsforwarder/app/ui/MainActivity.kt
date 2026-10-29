package com.smsforwarder.app.ui

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.smsforwarder.app.R
import com.smsforwarder.app.data.ForwardLogStore
import com.smsforwarder.app.data.MessageQueueStore
import com.smsforwarder.app.data.PairingStore
import com.smsforwarder.app.databinding.ActivityMainBinding
import com.smsforwarder.app.service.ForwardService

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private val adapter = ForwardLogAdapter()
    private val pairingStore by lazy { PairingStore(this) }
    private val logStore by lazy { ForwardLogStore(this) }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { refreshUi() }

    private val scanLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) {
        refreshUi()
        if (pairingStore.isPaired()) ForwardService.start(this)
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

        ensurePermissions()
        refreshUi()
        if (pairingStore.isPaired()) ForwardService.start(this)
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

    private fun ensurePermissions() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.RECEIVE_SMS)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.READ_SMS)
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
