<?php
/** Cierre del panel. Variable opcional: $scripts (lista de archivos en assets/js). */
?>
    </div>
  </main>
</div>
<script src="assets/js/common.js"></script>
<?php foreach (($scripts ?? []) as $s): ?>
<script src="assets/js/<?= e($s) ?>"></script>
<?php endforeach; ?>
</body>
</html>
