package com.basobaso.agroplanner;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable edge-to-edge layout so webview seamlessly extends behind the status bar and navigation bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        // Allow drawing around camera cutouts and display notches on Android P (API 28+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        // Set status bar & navigation bar icons to dark by default (matching the light #FAF7F2 / #FFFFFF theme)
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
            controller.setAppearanceLightNavigationBars(true);
        }

        // Forward system insets (status bar, notch cutout, gesture navigation) into WebView as CSS custom properties
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                Insets insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );

                float density = getResources().getDisplayMetrics().density;
                int topDp = Math.round(insets.top / density);
                int bottomDp = Math.round(insets.bottom / density);
                int leftDp = Math.round(insets.left / density);
                int rightDp = Math.round(insets.right / density);

                if (getBridge() != null && getBridge().getWebView() != null) {
                    String js = String.format(
                        "document.documentElement.style.setProperty('--safe-area-inset-top', '%dpx');" +
                        "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');" +
                        "document.documentElement.style.setProperty('--safe-area-inset-left', '%dpx');" +
                        "document.documentElement.style.setProperty('--safe-area-inset-right', '%dpx');",
                        topDp, bottomDp, leftDp, rightDp
                    );
                    getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
                }

                // Leave content view padding at 0 so WebView content bleeds smoothly edge-to-edge
                v.setPadding(0, 0, 0, 0);
                return windowInsets;
            });
        }
    }
}

