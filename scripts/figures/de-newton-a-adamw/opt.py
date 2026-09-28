import math
f = lambda x, y: x*x + 20*y*y
grad = lambda x, y: (2*x, 40*y)
START = (-2.6, 1.2)

def run(kind, eta, steps, b1=0.9, b2=0.999, eps=1e-8):
    x, y = START; path=[(x,y)]
    mx=my=vx=vy=0.0
    for t in range(1, steps+1):
        gx, gy = grad(x, y)
        if kind == 'gd':
            x -= eta*gx; y -= eta*gy
        elif kind == 'mom':
            mx = b1*mx + gx; my = b1*my + gy
            x -= eta*mx; y -= eta*my
        elif kind == 'rms':
            vx = b2*vx + (1-b2)*gx*gx; vy = b2*vy + (1-b2)*gy*gy
            x -= eta*gx/(math.sqrt(vx)+eps); y -= eta*gy/(math.sqrt(vy)+eps)
        elif kind == 'adam':
            mx = b1*mx + (1-b1)*gx; my = b1*my + (1-b1)*gy
            vx = b2*vx + (1-b2)*gx*gx; vy = b2*vy + (1-b2)*gy*gy
            mhx, mhy = mx/(1-b1**t), my/(1-b1**t)
            vhx, vhy = vx/(1-b2**t), vy/(1-b2**t)
            x -= eta*mhx/(math.sqrt(vhx)+eps); y -= eta*mhy/(math.sqrt(vhy)+eps)
        path.append((x,y))
    return path

def first_below(path, thr=0.01):
    for i,(x,y) in enumerate(path):
        if f(x,y) < thr: return i
    return None

if __name__ == '__main__':
    print("f(start) =", f(*START))
    for kind, eta, kw in [('gd',0.02,{}),('gd',0.045,{}),('gd',0.0475,{}),
                          ('mom',0.045,{'b1':0.9}),('mom',0.02,{'b1':0.9}),('mom',0.045,{'b1':0.8}),
                          ('rms',0.1,{'b2':0.9}),('rms',0.1,{'b2':0.999}),('rms',0.2,{'b2':0.9}),
                          ('adam',0.1,{}),('adam',0.2,{}),('adam',0.1,{'b2':0.95}),('adam',0.3,{})]:
        p = run(kind, eta, 200, **kw)
        fb = first_below(p)
        tail = ["(%.2f,%.2f)"%q for q in p[:6]]
        maxabs = max(abs(v) for q in p for v in q)
        print("%-5s eta=%-6g %-14s f<0.01 at step %-4s max|coord| %.2g  first: %s" % (kind, eta, kw, fb, maxabs, " ".join(tail)))
