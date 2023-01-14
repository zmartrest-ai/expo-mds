package expo.modules.mds

import com.movesense.mds.*
import expo.modules.core.errors.CodedException
import expo.modules.kotlin.Promise
import com.movesense.mds.MdsNotificationListener as MdsNotificationListener
import com.movesense.mds.Mds.builder as Builder
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

lateinit var mds: Mds
lateinit var bleScanner: BleScanner
var subscriptionMap = mutableMapOf<String, MdsSubscription>()

class ExpoMdsModule : Module() {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  override fun definition() = ModuleDefinition {


    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ExpoMds')` in JavaScript.
    Name("ExpoMds")

    // Sets constant properties on the module. Can take a dictionary or a closure that returns a dictionary.
    Constants(
      "PI" to Math.PI
    )

    class PromiseListener: MdsResponseListener {
      var promise: Promise
      constructor(promise: Promise){
        this.promise = promise;
      }

      override fun onError(p0: MdsException?) {
        var exceptionMessage = p0?.message ?: "MdsError";
        var error = expo.modules.kotlin.exception.CodedException(exceptionMessage)
        this.promise.reject(error)
      }

      override fun onSuccess(data: String?, header: MdsHeader?) {
        this.promise.resolve(data)
      }
    }

    class NotificationListener: MdsNotificationListener {
      var key: String
      constructor(key: String){
        this.key = key;
      }

      override fun onError(p0: MdsException?) {
        var exceptionMessage = p0?.message ?: "MdsError";
        var error = expo.modules.kotlin.exception.CodedException(exceptionMessage)
        sendEvent("newNotificationError", hashMapOf(
                "key" to key,
                "error" to error
        ))
      }

      override fun onNotification(p0: String?) {
        sendEvent("newNotification", hashMapOf(
                "key" to key,
                "notification" to p0
        ))
      }
    }

    class ConnectionListener: MdsConnectionListener {
      var promise: Promise
      constructor(promise: Promise){
        this.promise = promise;
      }

      override fun onConnect(p0: String?) {
        print("onConnect: $p0")
      }

      override fun onConnectionComplete(p0: String?, p1: String?) {
        print("onConnectionComplete $p0 $p1")
        this.promise.resolve(p0)
      }

      override fun onError(p0: MdsException?) {
        print("onError ${p0?.message}")

        var exceptionMessage = p0?.message ?: "MdsError";
        var error = expo.modules.kotlin.exception.CodedException(exceptionMessage)

        this.promise.reject(error)
      }

      override fun onDisconnect(p0: String?) {
        print("onDisconnect $p0")
      }

    }

    class BleListener: BleScanListener {
      override fun onDeviceFound(name: String, address: String) {
        sendEvent("newScannedDevice", hashMapOf(
                "name" to name,
                "address" to address
        ))
      }
    }

    Events("newScannedDevice", "newNotification", "newNotificationError")

    fun initMds(): Mds{
      if(::mds.isInitialized){
        return mds;
      }
      mds = Builder().build(appContext.reactContext);
      return mds;
    }

    fun initBleScanner(): BleScanner {
      if(::bleScanner.isInitialized){
        bleScanner
      }
      bleScanner = BleScanner(appContext.reactContext, BleListener());
      return bleScanner
    }

    Function("scan") {
      bleScanner = initBleScanner();
      bleScanner.scan()
    }

    Function("stopScan") {
      bleScanner = initBleScanner();
      bleScanner.stopScan()
    }


    Function("unsubscribe") { key: String ->
      var cb = subscriptionMap.get(key)
      cb?.unsubscribe()
      subscriptionMap.remove(key)
    }


    AsyncFunction("connect") { address: String, promise: Promise ->
      // Send an event to JavaScript.
      initMds().connect(address, null/*ConnectionListener(promise)*/)
    }

    Function("disconnect") { address: String ->
      // Send an event to JavaScript.
      initMds().disconnect(address)
    }

    AsyncFunction("get") { uri: String,
      parameters: String, promise: Promise ->
      // Send an event to JavaScript.
      initMds().get(uri, parameters, PromiseListener(promise))
    }

    AsyncFunction("post") { uri: String,
      parameters: String, promise: Promise ->
      // Send an event to JavaScript.
      initMds().post(uri, parameters, PromiseListener(promise))
    }

    AsyncFunction("put") { uri: String,
      parameters: String, promise: Promise ->
      // Send an event to JavaScript.
      initMds().put(uri, parameters, PromiseListener(promise))
    }

    AsyncFunction("delete") { uri: String,
      parameters: String, promise: Promise ->
      // Send an event to JavaScript.
      initMds().delete(uri, parameters, PromiseListener(promise))
    }

    // Defines a JavaScript synchronous function that runs the native code on the JavaScript thread.
    Function("subscribe") { uri: String, parameters: String, key: String ->
      var subscription = initMds().subscribe(
              uri,
              parameters,
              NotificationListener(key),
      );

      subscriptionMap[key] = subscription
    }

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("setValueAsync") { value: String ->
      // Send an event to JavaScript.
      sendEvent("onChange", mapOf(
        "value" to value
      ))


      /*
      self.mds.subscribe(uri, parameters: parameters, onNotify: { notification in
              self.sendEvent("newNotification", [
                "notification": notification,
                "key": key
              ])
          }, onError: { (uri, error) in
              self.sendEvent("newNotificationError", [
                "uri": uri,
                                                    "error": error,
                                                    "key": key])
          })
       */
    }

    // Enables the module to be used as a native view. Definition components that are accepted as part of
    // the view definition: Prop, Events.
    View(ExpoMdsView::class) {
      // Defines a setter for the `name` prop.
      Prop("name") { view: ExpoMdsView, prop: String ->
        println(prop)
      }
    }
  }
}
