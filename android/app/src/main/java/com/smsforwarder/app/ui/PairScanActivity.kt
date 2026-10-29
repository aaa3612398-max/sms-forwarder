package com.smsforwarder.app.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.zxing.integration.android.IntentIntegrator
import com.smsforwarder.app.data.PairingStore
import com.smsforwarder.app.protocol.PairingCodec

class PairScanActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        IntentIntegrator(this)
            .setPrompt("扫描电脑上的配对二维码")
            .setBeepEnabled(false)
            .setOrientationLocked(true)
            .initiateScan()
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        val result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (result != null) {
            if (result.contents != null) {
                try {
                    val config = PairingCodec.decode(result.contents)
                    PairingStore(this).save(config)
                    Toast.makeText(this, "配对成功", Toast.LENGTH_SHORT).show()
                    setResult(RESULT_OK)
                } catch (e: Exception) {
                    Toast.makeText(this, "二维码无效：${e.message}", Toast.LENGTH_LONG).show()
                    setResult(RESULT_CANCELED)
                }
            } else {
                setResult(RESULT_CANCELED)
            }
            finish()
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }
}
