# Repository checks

Use the container workflow by default; do not install system packages on the host.

```sh
docker build -t acornaut-checks .
docker run --rm acornaut-checks
```

The image runs the source export, lab build, typecheck, art gate, complete test
harness and platform bridge check. Keep `.git` in the build context because
historical art regressions read pinned revisions with `git archive`.

When Docker is unavailable, record that limitation and use workspace-local
Node dependencies and an available Python with Pillow/NumPy; no host system
package installation is needed. `ACORNAUT_TSC`, `ACORNAUT_CANVAS` and
`ACORNAUT_HAPPY_DOM` may point to existing package entry files. Read
`SHIPPING.md` for the complete required workflow. There is no lint script;
use typecheck and `git diff --check` alongside the tests.

Flight Studio is a separately launched offline tool under `tools/flight-studio`.
Edit its UI/runtime in `illustrated-src/flight-studio`, then run
`node illustrated-src/build-flight-studio.mjs`. Commit its generated modules
and manifest so the launcher requires only existing Node, with no install or
network. Game painters are generated from source, never edited in the tool.
`node illustrated-src/test-flight-studio.mjs` verifies the standalone runtime,
exports, all model assets and read-only host. The Docker workflow already runs
every test file; use the same documented fallback when Docker is unavailable.
