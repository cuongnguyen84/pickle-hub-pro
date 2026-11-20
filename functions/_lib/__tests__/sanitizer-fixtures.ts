export const attacks = [
  '<img src=x onerror=alert(1)>', '<a href=javascript:alert(1)>click</a>',
  '<a href="java&#x73;cript:alert(1)">click</a>', '<a href="java&#9;script:alert(1)">x</a>',
  '<svg><a xlink:href="javascript:alert(1)">x</a></svg>', '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
  '<style><img src=x onerror=alert(1)></style>', '<script>alert(1)</script>',
  '<scr<script>ipt>alert(1)</scr</script>ipt>', '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>">',
  '<svg></p><style><g title="</style><img src onerror=alert(1)>">',
  '<a href="data:text/html,evil">data</a><img src="data:image/svg+xml,evil">',
  '<a href="//evil.test">x</a><a href="/\\evil.test">y</a>',
  '<div id=location name=location style="background:url(evil)"><form><input name=attributes></form></div>',
  '<template><img src=x onerror=alert(1)></template><custom onclick=alert(1)>text</custom>',
];
