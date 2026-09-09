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
