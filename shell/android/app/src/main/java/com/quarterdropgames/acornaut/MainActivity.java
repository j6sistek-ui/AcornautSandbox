package com.quarterdropgames.acornaut;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BoardsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
