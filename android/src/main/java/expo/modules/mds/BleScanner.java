package expo.modules.mds;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

public class BleScanner {

    private final BroadcastReceiver receiver;

    private final BluetoothAdapter mBluetoothAdapter;

    private final Context context;

    BleScanner(Context context, final BleScanListener listener) {
        mBluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        this.context = context;
        receiver = new BroadcastReceiver() {
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                    BluetoothDevice device = (BluetoothDevice) intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    var name = device.getName();
                    var alias = device.getAlias();
                    var address = device.getAddress();
                    if(address != null && name != null){
                        listener.onDeviceFound(name != null ? name : address, address);
                    }
                }
            }
        };
    }

    public void scan() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        context.registerReceiver(receiver, filter);
        mBluetoothAdapter.startDiscovery();
    }

    public void stopScan() {
        mBluetoothAdapter.cancelDiscovery();
        try {
            context.unregisterReceiver(receiver);
        } catch (Throwable t) {

        }
    }


}