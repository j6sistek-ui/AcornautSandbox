package com.quarterdropgames.acornaut;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.tasks.Task;

/**
 * GOOGLE PLAY GAMES leaderboards, behind the same board contract as the
 * iOS plugin. Play Games Services v2: sign-in is automatic at launch, so
 * signIn() only reports the result. The package line is stamped by
 * `npm run configure`, which also adds the play-services dependency and
 * the APP_ID manifest entry.
 */
@CapacitorPlugin(name = "Boards")
public class BoardsPlugin extends Plugin {
    private static final int RC_LEADERBOARD = 9004;

    @Override
    public void load() {
        PlayGamesSdk.initialize(getContext());
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        PlayGames.getGamesSignInClient(getActivity()).isAuthenticated().addOnCompleteListener(task -> {
            boolean ok = task.isSuccessful() && task.getResult() != null && task.getResult().isAuthenticated();
            if (ok) { resolveSignIn(call, true); return; }
            PlayGames.getGamesSignInClient(getActivity()).signIn().addOnCompleteListener(t2 -> {
                boolean ok2 = t2.isSuccessful() && t2.getResult() != null && t2.getResult().isAuthenticated();
                resolveSignIn(call, ok2);
            });
        });
    }

    private void resolveSignIn(PluginCall call, boolean signedIn) {
        JSObject r = new JSObject();
        r.put("signedIn", signedIn);
        call.resolve(r);
    }

    @PluginMethod
    public void submitScore(PluginCall call) {
        String leaderboardId = call.getString("leaderboardId");
        Integer score = call.getInt("score");
        if (leaderboardId == null || score == null) { call.reject("leaderboardId and score are required"); return; }
        PlayGames.getLeaderboardsClient(getActivity()).submitScore(leaderboardId, score);
        JSObject r = new JSObject();
        r.put("submitted", true);
        call.resolve(r);
    }

    @PluginMethod
    public void showLeaderboard(PluginCall call) {
        String leaderboardId = call.getString("leaderboardId");
        Task<Intent> task = leaderboardId != null
            ? PlayGames.getLeaderboardsClient(getActivity()).getLeaderboardIntent(leaderboardId)
            : PlayGames.getLeaderboardsClient(getActivity()).getAllLeaderboardsIntent();
        task.addOnSuccessListener(intent -> { getActivity().startActivityForResult(intent, RC_LEADERBOARD); call.resolve(); })
            .addOnFailureListener(e -> call.reject(e.getMessage()));
    }
}
